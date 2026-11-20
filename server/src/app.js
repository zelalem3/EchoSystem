const { createServer } = require("http");
const { Server } = require("socket.io");
const { createMessageService } = require("./services/messageService");
const { createPresenceService } = require("./services/presenceService");
const { registerSocketHandlers } = require("./socket/registerHandlers");
const { corsMiddleware, corsOptions } = require("./config/cors");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});
redisClient.on("error", (err) => console.error("Redis error:", err));
await redisClient.connect();

const httpLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: "rl:http:",
  }),
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.socket.remoteAddress ?? "unknown",
});

const SOCKET_CONN_LIMIT = 30; 
const SOCKET_CONN_WINDOW = 60; 

async function isSocketConnLimited(clientIp) {
  const key = `rl:ws_conn:${clientIp}`;
  const current = await redisClient.incr(key);
  if (current === 1) {
    await redisClient.expire(key, SOCKET_CONN_WINDOW);
  }
  return current > SOCKET_CONN_LIMIT;
}

function createApp({ auth, db }) {
  const httpServer = createServer((req, res) => {
    corsMiddleware(req, res, () => {
      if (req.url === "/health") {
        const isReady = redisClient.isReady;
        res.writeHead(isReady ? 200 : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: isReady ? "ok" : "unavailable" }));
        return;
      }

      httpLimiter(req, res, () => {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      });
    });
  });

  const io = new Server(httpServer, { cors: corsOptions });

  // 1. Connection rate limit (per IP)
  io.use(async (socket, next) => {
    const ip =
      socket.handshake.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      socket.handshake.address;

    try {
      if (await isSocketConnLimited(ip)) {
        return next(new Error("Too many connection attempts, try again later"));
      }
    } catch {
      console.warn("Rate limit check failed, allowing connection");
    }
    next();
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
      return next(new Error("Authentication required"));
    }
    try {
      const decodedToken = await auth.verifyIdToken(token);
      if (!decodedToken.uid || !decodedToken.email) {
        return next(new Error("A Firebase account with an email is required"));
      }
      socket.data.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || "",
      };
      next();
    } catch {
      next(new Error("Invalid or expired authentication token"));
    }
  });

  registerSocketHandlers(io, {
    db,
    messages: createMessageService(db),
    presence: createPresenceService(redisClient),
  });

  return { httpServer, io };
}

module.exports = { createApp };   
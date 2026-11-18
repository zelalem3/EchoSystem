const { createServer } = require("http");
const { Server } = require("socket.io");
const { createMessageService } = require("./services/messageService");
const { createPresenceService } = require("./services/presenceService");
const { registerSocketHandlers } = require("./socket/registerHandlers");
const { corsMiddleware, corsOptions } = require("./config/cors");

function createApp({ auth, db, redisClient }) {
  const httpServer = createServer((req, res) => {
    corsMiddleware(req, res, () => {
      if (req.url !== "/health") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const isReady = !process.env.REDIS_URL || redisClient?.isReady;
      res.writeHead(isReady ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: isReady ? "ok" : "unavailable" }));
    });
  });

  const io = new Server(httpServer, {
    cors: corsOptions,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
      next(new Error("Authentication required"));
      return;
    }

    try {
      const decodedToken = await auth.verifyIdToken(token);
      if (!decodedToken.uid || !decodedToken.email) {
        next(new Error("A Firebase account with an email is required"));
        return;
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

const { createServer } = require("http");
const { Server } = require("socket.io");
const { createMessageService } = require("./services/messageService");
const { createPresenceService } = require("./services/presenceService");
const { registerSocketHandlers } = require("./socket/registerHandlers");

function createApp({ db, redisClient }) {
  const httpServer = createServer((req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const isReady = !process.env.REDIS_URL || redisClient?.isReady;
    res.writeHead(isReady ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: isReady ? "ok" : "unavailable" }));
  });

  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ||
    "http://localhost:5173,http://localhost:8080,https://echo-system-six.vercel.app"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  registerSocketHandlers(io, {
    db,
    messages: createMessageService(db),
    presence: createPresenceService(redisClient),
  });

  return { httpServer, io };
}

module.exports = { createApp };

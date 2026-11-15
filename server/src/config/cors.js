const cors = require("cors");

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  "http://localhost:5173,http://localhost:8080,https://echo-system-six.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
};

module.exports = {
  corsMiddleware: cors(corsOptions),
  corsOptions,
};

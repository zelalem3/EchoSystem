const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { auth, db } = require("./config/firebase");
const { createApp } = require("./app");

const PORT = process.env.PORT || 10000;

async function startServer() {
  let redisClient;
  let redisSubscriber;

  if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisSubscriber = redisClient.duplicate();

    redisClient.on("error", (err) => console.error("Redis publisher error:", err));
    redisSubscriber.on("error", (err) =>
      console.error("Redis subscriber error:", err)
    );

    await Promise.all([redisClient.connect(), redisSubscriber.connect()]);
  } else {
    console.warn("REDIS_URL is unset; running in single-instance mode.");
  }

  const { httpServer, io } = createApp({ auth, db, redisClient });
  if (redisClient) {
    io.adapter(createAdapter(redisClient, redisSubscriber));
    console.log("Redis adapter and shared presence enabled.");
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`EchoSystem Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup failed:", err);
  process.exitCode = 1;
});

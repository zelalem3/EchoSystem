const { createServer } = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const admin = require("firebase-admin");

const PORT = process.env.PORT || 10000;

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const httpServer = createServer();

// 2. UPDATED CORS FOR VERCEL
const io = new Server(httpServer, {
  cors: { 
    origin: ["http://localhost:5173", "https://echo-system-six.vercel.app"], 
    methods: ["GET", "POST"],
    credentials: true
  },
});

const localRoomUsers = new Map();
let redisClient;

const MESSAGE_PAGE_SIZE = 3;
const PRESENCE_TTL_MS = 60_000;
const PRESENCE_HEARTBEAT_MS = 20_000;
const PRESENCE_KEY_PREFIX = "echosystem:presence:";

function getPresenceKey(roomId) {
  return `${PRESENCE_KEY_PREFIX}${encodeURIComponent(roomId)}`;
}

async function getRoomUserCount(roomId) {
  if (redisClient) {
    const key = getPresenceKey(roomId);
    await redisClient.zRemRangeByScore(key, 0, Date.now() - PRESENCE_TTL_MS);
    const count = await redisClient.zCard(key);
    if (count === 0) await redisClient.del(key);
    return count;
  }

  return localRoomUsers.get(roomId)?.size || 0;
}

async function addRoomUser(roomId, socketId) {
  if (redisClient) {
    const key = getPresenceKey(roomId);
    await redisClient.zAdd(key, { score: Date.now(), value: socketId });
    await redisClient.pExpire(key, PRESENCE_TTL_MS * 2);
    return getRoomUserCount(roomId);
  }

  if (!localRoomUsers.has(roomId)) localRoomUsers.set(roomId, new Set());
  const users = localRoomUsers.get(roomId);
  users.add(socketId);
  return users.size;
}

async function removeRoomUser(roomId, socketId) {
  if (redisClient) {
    const key = getPresenceKey(roomId);
    await redisClient.zRem(key, socketId);
    return getRoomUserCount(roomId);
  }

  const users = localRoomUsers.get(roomId);
  if (!users) return 0;

  users.delete(socketId);
  if (users.size === 0) localRoomUsers.delete(roomId);
  return users.size;
}

async function refreshRoomUser(roomId, socketId) {
  if (!redisClient) return;

  const key = getPresenceKey(roomId);
  await redisClient.zAdd(key, { score: Date.now(), value: socketId });
  await redisClient.pExpire(key, PRESENCE_TTL_MS * 2);
}

async function getRoomMessages(roomId, limit = MESSAGE_PAGE_SIZE, cursor = null) {
  const messagesRef = db.collection("rooms").doc(roomId).collection("messages");
  let query = messagesRef.orderBy("timestamp", "desc").limit(limit + 1);

  if (cursor) {
    const cursorSnapshot = await messagesRef.doc(cursor).get();
    if (!cursorSnapshot.exists) {
      throw new Error("Message pagination cursor was not found");
    }
    query = query.startAfter(cursorSnapshot);
  }

  const snapshot = await query.get();
  const hasMore = snapshot.docs.length > limit;
  const pageDocs = snapshot.docs.slice(0, limit);
  const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : null;

  return {
    messages: [...pageDocs].reverse().map((doc) => ({ id: doc.id, ...doc.data() })),
    cursor: nextCursor,
    hasMore,
  };
}


io.on("connection", (socket) => {
  console.log("Connected:", socket.id);
  socket.data.presenceRooms = new Set();

  const presenceHeartbeat = setInterval(() => {
    Promise.all(
      [...socket.data.presenceRooms].map((roomId) =>
        refreshRoomUser(roomId, socket.id)
      )
    ).catch((err) => console.error("Presence Heartbeat Error:", err));
  }, PRESENCE_HEARTBEAT_MS);

  socket.on("joinRoom", async ({ roomId, user }) => {
    if (!roomId || !user) return;

    try {
      await socket.join(roomId);
      socket.data.presenceRooms.add(roomId);
      io.to(roomId).emit("userCountUpdate", await addRoomUser(roomId, socket.id));

      const batch = db.batch();
      const roomMemberRef = db.collection("rooms").doc(roomId).collection("members").doc(user.email);
      batch.set(roomMemberRef, { email: user.email, joinedAt: new Date().toISOString() }, { merge: true });

      const userRoomRef = db.collection("users").doc(user.email).collection("joined_rooms").doc(roomId);
      batch.set(userRoomRef, { roomId: roomId, lastAccessed: new Date().toISOString() }, { merge: true });

      await batch.commit();

      const page = await getRoomMessages(roomId);
      socket.emit("chatHistory", { roomId, ...page });
    } catch (err) {
      console.error("Join Room Error:", err);
      socket.emit("roomError", {
        roomId,
        message: "Unable to join the room. Please try again.",
      });
    }
  });

  socket.on("loadOlderMessages", async (payload = {}) => {
    const { roomId, cursor } = payload || {};
    if (!roomId || !cursor || !socket.rooms.has(roomId)) return;

    try {
      const page = await getRoomMessages(roomId, MESSAGE_PAGE_SIZE, cursor);
      socket.emit("olderChatHistory", { roomId, ...page });
    } catch (err) {
      console.error("Older Messages Error:", err);
      socket.emit("chatHistoryError", {
        roomId,
        message: "Unable to load older messages.",
      });
    }
  });

  socket.on("leaveRoom", async (roomId) => {
    if (!roomId || !socket.rooms.has(roomId)) return;

    try {
      await socket.leave(roomId);
      socket.data.presenceRooms.delete(roomId);
      io.to(roomId).emit("userCountUpdate", await removeRoomUser(roomId, socket.id));
    } catch (err) {
      console.error("Leave Room Presence Error:", err);
    }
  });

  socket.on("getUserRooms", async (email) => {
    try {
      const snapshot = await db.collection("users").doc(email).collection("joined_rooms").get();
      const rooms = snapshot.docs.map(doc => doc.data().roomId);
      socket.emit("userRoomsList", rooms);
    } catch (err) {
      console.error("Fetch Rooms Error:", err);
    }
  });

  socket.on("sendMessage", async ({ roomId, message, user }) => {
    const messageData = { 
      email: user.email, 
      message, 
      timestamp: new Date().toISOString() 
    };
    await db.collection("rooms").doc(roomId).collection("messages").add(messageData);
    io.to(roomId).emit("receiveMessage", messageData);
  });

  socket.on("typing", ({ roomId, user, isTyping }) => {
    socket.to(roomId).emit("userTypingUpdate", { email: user.email, isTyping });
  });

  socket.on("disconnecting", async () => {
    clearInterval(presenceHeartbeat);
    socket.rooms.forEach(roomId => {
      if (roomId !== socket.id) socket.data.presenceRooms.add(roomId);
    });

    await Promise.all(
      [...socket.data.presenceRooms].map(async (roomId) => {
        try {
          io.to(roomId).emit("userCountUpdate", await removeRoomUser(roomId, socket.id));
        } catch (err) {
          console.error("Disconnect Presence Error:", err);
        }
      })
    );
  });
});

async function startServer() {
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => console.error("Redis publisher error:", err));
    subClient.on("error", (err) => console.error("Redis subscriber error:", err));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    redisClient = pubClient;
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Redis adapter and shared presence enabled.");
  } else {
    console.warn("REDIS_URL is unset; running in single-instance mode.");
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`EchoSystem Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup failed:", err);
  process.exitCode = 1;
});
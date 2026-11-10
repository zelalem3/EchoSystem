const { createServer } = require("http");
const { Server } = require("socket.io");
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

const roomUsers = {}; 

const MESSAGE_PAGE_SIZE = 3;

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

  socket.on("joinRoom", async ({ roomId, user }) => {
    if (!roomId || !user) return;
    socket.join(roomId);

    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(socket.id);
    io.to(roomId).emit("userCountUpdate", roomUsers[roomId].size);

    const batch = db.batch();
    const roomMemberRef = db.collection("rooms").doc(roomId).collection("members").doc(user.email);
    batch.set(roomMemberRef, { email: user.email, joinedAt: new Date().toISOString() }, { merge: true });

    const userRoomRef = db.collection("users").doc(user.email).collection("joined_rooms").doc(roomId);
    batch.set(userRoomRef, { roomId: roomId, lastAccessed: new Date().toISOString() }, { merge: true });

    await batch.commit();

    try {
      const page = await getRoomMessages(roomId);
      socket.emit("chatHistory", { roomId, ...page });
    } catch (err) {
      console.error("History Error:", err);
      socket.emit("chatHistoryError", {
        roomId,
        message: "Unable to load chat history.",
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

  socket.on("leaveRoom", (roomId) => {
    if (!roomId || !socket.rooms.has(roomId)) return;

    socket.leave(roomId);
    if (roomUsers[roomId]) {
      roomUsers[roomId].delete(socket.id);
      io.to(roomId).emit("userCountUpdate", roomUsers[roomId].size);
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

  socket.on("disconnecting", () => {
    socket.rooms.forEach(roomId => {
      if (roomUsers[roomId]) {
        roomUsers[roomId].delete(socket.id);
        io.to(roomId).emit("userCountUpdate", roomUsers[roomId].size);
      }
    });
  });
});

// 3. LISTEN ON 0.0.0.0 FOR RENDER
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`EchoSystem Server running on port ${PORT}`);
});
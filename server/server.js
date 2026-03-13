const { createServer } = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});

const roomUsers = {}; // Memory store for active socket counts

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // JOIN OR CREATE ROOM
  socket.on("joinRoom", async ({ roomId, user }) => {
    if (!roomId || !user) return;
    socket.join(roomId);

    // 1. Manage Active Presence (Socket level)
    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(socket.id);
    io.to(roomId).emit("userCountUpdate", roomUsers[roomId].size);

    // 2. Persist Relationship (Firestore level)
    const batch = db.batch();
    
    // Room -> Members list
    const roomMemberRef = db.collection("rooms").doc(roomId).collection("members").doc(user.email);
    batch.set(roomMemberRef, { email: user.email, joinedAt: new Date().toISOString() }, { merge: true });

    // User -> Joined Rooms list
    const userRoomRef = db.collection("users").doc(user.email).collection("joined_rooms").doc(roomId);
    batch.set(userRoomRef, { roomId: roomId, lastAccessed: new Date().toISOString() }, { merge: true });

    await batch.commit();

    // 3. Fetch Message History
    try {
      const snapshot = await db.collection("rooms").doc(roomId).collection("messages")
        .orderBy("timestamp", "asc").get();
      socket.emit("chatHistory", snapshot.docs.map(doc => doc.data()));
    } catch (err) {
      console.error("History Error:", err);
    }
  });

  // GET SAVED ROOMS FOR SIDEBAR
  socket.on("getUserRooms", async (email) => {
    try {
      const snapshot = await db.collection("users").doc(email).collection("joined_rooms").get();
      const rooms = snapshot.docs.map(doc => doc.data().roomId);
      socket.emit("userRoomsList", rooms);
    } catch (err) {
      console.error("Fetch Rooms Error:", err);
    }
  });

  // SEND MESSAGE
  socket.on("sendMessage", async ({ roomId, message, user }) => {
    const messageData = { 
      email: user.email, 
      message, 
      timestamp: new Date().toISOString() 
    };
    await db.collection("rooms").doc(roomId).collection("messages").add(messageData);
    io.to(roomId).emit("receiveMessage", messageData);
  });

  // TYPING INDICATOR
  socket.on("typing", ({ roomId, user, isTyping }) => {
    socket.to(roomId).emit("userTypingUpdate", { email: user.email, isTyping });
  });

  // DISCONNECT LOGIC
  socket.on("disconnecting", () => {
    socket.rooms.forEach(roomId => {
      if (roomUsers[roomId]) {
        roomUsers[roomId].delete(socket.id);
        io.to(roomId).emit("userCountUpdate", roomUsers[roomId].size);
      }
    });
  });
});

httpServer.listen(5000, () => console.log("Server on :5000"));
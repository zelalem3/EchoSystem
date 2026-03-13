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
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const roomUsers = {};
io.on("connection", (socket) => {
 
  socket.on("joinRoom", async (roomId) => {
    socket.join(roomId);
 
    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(socket.id);

  
    io.to(roomId).emit("userCountUpdate", roomUsers[roomId].size);
    
    try {
   
      const snapshot = await db.collection("rooms")
        .doc(roomId)
        .collection("messages")
        .orderBy("timestamp", "asc") 
        .get();

      const messages = snapshot.docs.map(doc => doc.data());
      socket.emit("chatHistory", messages);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  });

  socket.on("sendMessage", async ({ roomId, message, user }) => {
    const messageData = { 
      email: user.email, 
      message: message, 
      timestamp: new Date().toISOString() 
    };

    // Save to Firestore
    await db.collection("rooms").doc(roomId).collection("messages").add(messageData);

    // Emit to EVERYONE in the room including the sender so their UI updates
    io.to(roomId).emit("receiveMessage", messageData);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);
    if (roomUsers[roomId]) {
      roomUsers[roomId].delete(socket.id);
      io.to(roomId).emit("userCountUpdate", roomUsers[roomId].size);
    }
    console.log(`User ${socket.id} left room ${roomId}`);
  });
 

  socket.on("createRoom", async (roomId) => {
    // In a real app, you might want to check if the room already exists
    if (!roomId) return;
    if(await db.collection("rooms").doc(roomId).get().exists) {
      console.log(`Room ${roomId} already exists.`);
      return;
    }
    
    // Create a new room document in Firestore (optional, but good for tracking)
    db.collection("rooms").doc(roomId).set({ createdAt: new Date().toISOString() });
    console.log(`Room created: ${roomId}`);
  });
  

  socket.on("disconnect", () => {
    console.log("A user disconnected: " + socket.id);
  });
socket.on("disconnecting", () => {
    // Handle unexpected disconnects (closing tab)
    socket.rooms.forEach(roomId => {
      if (roomUsers[roomId]) {
        roomUsers[roomId].delete(socket.id);
        io.to(roomId).emit("userCountUpdate", roomUsers[roomId].size);
      }
    });


});
});
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

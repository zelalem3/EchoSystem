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

// ... (Your existing imports and admin.initializeApp)

io.on("connection", (socket) => {
  // Use "joinRoom" to match the client
  socket.on("joinRoom", async (roomId) => {
    socket.join(roomId);
    
    try {
      // Get messages ordered by timestamp so the chat makes sense
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
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  

  socket.on("disconnect", () => {
    console.log("A user disconnected: " + socket.id);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
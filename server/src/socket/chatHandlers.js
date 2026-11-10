function registerChatHandlers(socket, io, db) {
  socket.on("sendMessage", async ({ roomId, message, user } = {}) => {
    const messageData = {
      email: user.email,
      message,
      timestamp: new Date().toISOString(),
    };

    await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .add(messageData);
    io.to(roomId).emit("receiveMessage", messageData);
  });

  socket.on("typing", ({ roomId, user, isTyping }) => {
    socket.to(roomId).emit("userTypingUpdate", {
      email: user.email,
      isTyping,
    });
  });
}

module.exports = { registerChatHandlers };

function registerUserHandlers(socket, db) {
  socket.on("getUserRooms", async (email) => {
    try {
      const snapshot = await db
        .collection("users")
        .doc(email)
        .collection("joined_rooms")
        .get();
      const rooms = snapshot.docs.map((doc) => doc.data().roomId);
      socket.emit("userRoomsList", rooms);
    } catch (err) {
      console.error("Fetch Rooms Error:", err);
    }
  });
}

module.exports = { registerUserHandlers };

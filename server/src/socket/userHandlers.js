const { isRoomMember, isValidRoomId } = require("./guards");

function registerUserHandlers(socket, db) {
  socket.on("getUserRooms", async () => {
    try {
      const { email } = socket.data.user;
      const snapshot = await db
        .collection("users")
        .doc(email)
        .collection("joined_rooms")
        .get();
      const rooms = (
        await Promise.all(
          snapshot.docs.map(async (doc) => {
            const roomId = doc.data().roomId;
            if (!isValidRoomId(roomId)) return null;
            return (await isRoomMember(db, roomId, email)) ? roomId : null;
          })
        )
      ).filter(Boolean);
      socket.emit("userRoomsList", rooms);
    } catch (err) {
      console.error("Fetch Rooms Error:", err);
    }
  });
}

module.exports = { registerUserHandlers };

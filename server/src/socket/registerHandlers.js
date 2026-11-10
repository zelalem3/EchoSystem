const { registerChatHandlers } = require("./chatHandlers");
const { registerRoomHandlers } = require("./roomHandlers");
const { registerUserHandlers } = require("./userHandlers");

function registerSocketHandlers(io, dependencies) {
  const { db, messages, presence } = dependencies;

  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);
    socket.data.presenceRooms = new Set();

    const clearPresenceHeartbeat = registerRoomHandlers(socket, io, {
      db,
      messages,
      presence,
    });
    registerChatHandlers(socket, io, db);
    registerUserHandlers(socket, db);

    socket.on("disconnecting", async () => {
      clearPresenceHeartbeat();

      socket.rooms.forEach((roomId) => {
        if (roomId !== socket.id) socket.data.presenceRooms.add(roomId);
      });

      await Promise.all(
        [...socket.data.presenceRooms].map(async (roomId) => {
          try {
            io.to(roomId).emit(
              "userCountUpdate",
              await presence.removeRoomUser(roomId, socket.id)
            );
          } catch (err) {
            console.error("Disconnect Presence Error:", err);
          }
        })
      );
    });
  });
}

module.exports = { registerSocketHandlers };

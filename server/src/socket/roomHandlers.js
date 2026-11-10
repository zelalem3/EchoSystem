const { MESSAGE_PAGE_SIZE } = require("../services/messageService");

const PRESENCE_HEARTBEAT_MS = 20_000;

function registerRoomHandlers(socket, io, { db, messages, presence }) {
  const presenceHeartbeat = setInterval(() => {
    Promise.all(
      [...socket.data.presenceRooms].map((roomId) =>
        presence.refreshRoomUser(roomId, socket.id)
      )
    ).catch((err) => console.error("Presence Heartbeat Error:", err));
  }, PRESENCE_HEARTBEAT_MS);

  socket.on("joinRoom", async ({ roomId, user } = {}) => {
    if (!roomId || !user?.email) return;

    try {
      await socket.join(roomId);
      socket.data.presenceRooms.add(roomId);
      io.to(roomId).emit("userCountUpdate", await presence.addRoomUser(roomId, socket.id));

      const batch = db.batch();
      const roomMemberRef = db
        .collection("rooms")
        .doc(roomId)
        .collection("members")
        .doc(user.email);
      batch.set(
        roomMemberRef,
        { email: user.email, joinedAt: new Date().toISOString() },
        { merge: true }
      );

      const userRoomRef = db
        .collection("users")
        .doc(user.email)
        .collection("joined_rooms")
        .doc(roomId);
      batch.set(
        userRoomRef,
        { roomId, lastAccessed: new Date().toISOString() },
        { merge: true }
      );

      await batch.commit();

      const page = await messages.getRoomMessages(roomId);
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
      const page = await messages.getRoomMessages(roomId, MESSAGE_PAGE_SIZE, cursor);
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
      io.to(roomId).emit(
        "userCountUpdate",
        await presence.removeRoomUser(roomId, socket.id)
      );
    } catch (err) {
      console.error("Leave Room Presence Error:", err);
    }
  });

  return () => clearInterval(presenceHeartbeat);
}

module.exports = { registerRoomHandlers };

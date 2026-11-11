const { MESSAGE_PAGE_SIZE } = require("../services/messageService");
const { consumeRateLimit, isRoomMember, isValidRoomId } = require("./guards");

const PRESENCE_HEARTBEAT_MS = 20_000;

function registerRoomHandlers(socket, io, { db, messages, presence }) {
  const presenceHeartbeat = setInterval(() => {
    Promise.all(
      [...socket.data.presenceRooms].map((roomId) =>
        presence.refreshRoomUser(roomId, socket.id)
      )
    ).catch((err) => console.error("Presence Heartbeat Error:", err));
  }, PRESENCE_HEARTBEAT_MS);

  socket.on("joinRoom", async (payload = {}) => {
    const { roomId } = payload || {};
    if (!isValidRoomId(roomId)) {
      socket.emit("roomError", { roomId, message: "Invalid room name." });
      return;
    }
    if (!consumeRateLimit(socket, "joinRoom", 10, 60_000)) {
      socket.emit("roomError", {
        roomId,
        message: "Too many room requests. Please wait and try again.",
      });
      return;
    }

    try {
      const user = socket.data.user;
      const roomRef = db.collection("rooms").doc(roomId);
      const memberRef = roomRef.collection("members").doc(user.email);
      const userRoomRef = db
        .collection("users")
        .doc(user.email)
        .collection("joined_rooms")
        .doc(roomId);
      const joinedAt = new Date().toISOString();
      const authorized = await db.runTransaction(async (transaction) => {
        const memberSnapshot = await transaction.get(memberRef);
        if (memberSnapshot.exists) {
          transaction.set(userRoomRef, { roomId, lastAccessed: joinedAt }, { merge: true });
          return true;
        }

        const [roomSnapshot, membersSnapshot] = await Promise.all([
          transaction.get(roomRef),
          transaction.get(roomRef.collection("members").limit(1)),
        ]);
        if (roomSnapshot.exists || !membersSnapshot.empty) return false;

        transaction.create(roomRef, { createdBy: user.uid, createdAt: joinedAt });
        transaction.set(memberRef, { email: user.email, joinedAt });
        transaction.set(userRoomRef, { roomId, lastAccessed: joinedAt });
        return true;
      });

      if (!authorized) {
        socket.emit("roomError", {
          roomId,
          message: "You do not have access to this room.",
        });
        return;
      }

      await socket.join(roomId);
      socket.data.presenceRooms.add(roomId);
      io.to(roomId).emit("userCountUpdate", await presence.addRoomUser(roomId, socket.id));

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
    if (
      !isValidRoomId(roomId) ||
      typeof cursor !== "string" ||
      !cursor ||
      cursor.includes("/") ||
      cursor.length > 1500 ||
      !socket.rooms.has(roomId)
    ) {
      socket.emit("chatHistoryError", {
        roomId,
        message: "Invalid history request.",
      });
      return;
    }

    try {
      if (!(await isRoomMember(db, roomId, socket.data.user.email))) {
        socket.emit("chatHistoryError", {
          roomId,
          message: "You do not have access to this room.",
        });
        return;
      }
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
    if (!isValidRoomId(roomId) || !socket.rooms.has(roomId)) return;

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

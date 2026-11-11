const {
  MAX_MESSAGE_LENGTH,
  consumeRateLimit,
  isRoomMember,
  isValidRoomId,
} = require("./guards");

function registerChatHandlers(socket, io, db) {
  socket.on("sendMessage", async (payload = {}, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const { roomId, message } = payload || {};
    const text = typeof message === "string" ? message.trim() : "";

    if (!isValidRoomId(roomId) || !text || text.length > MAX_MESSAGE_LENGTH) {
      respond({ ok: false, error: "Invalid message or room." });
      return;
    }
    if (!consumeRateLimit(socket, "sendMessage", 5, 10_000)) {
      respond({ ok: false, error: "You are sending messages too quickly." });
      return;
    }
    if (!socket.rooms.has(roomId)) {
      respond({ ok: false, error: "Join this room before sending a message." });
      return;
    }

    try {
      const user = socket.data.user;
      if (!(await isRoomMember(db, roomId, user.email))) {
        respond({ ok: false, error: "You do not have access to this room." });
        return;
      }

      const messageData = {
        email: user.email,
        message: text,
        timestamp: new Date().toISOString(),
      };
      const savedMessage = await db
        .collection("rooms")
        .doc(roomId)
        .collection("messages")
        .add(messageData);
      const deliveredMessage = { id: savedMessage.id, ...messageData };

      io.to(roomId).emit("receiveMessage", deliveredMessage);
      respond({ ok: true, message: deliveredMessage });
    } catch (err) {
      console.error("Send Message Error:", err);
      respond({ ok: false, error: "Unable to send the message. Please try again." });
    }
  });

  socket.on("typing", async (payload = {}) => {
    const { roomId, isTyping } = payload || {};
    if (!isValidRoomId(roomId) || typeof isTyping !== "boolean") return;
    if (!consumeRateLimit(socket, "typing", 10, 5_000) || !socket.rooms.has(roomId)) return;

    try {
      const user = socket.data.user;
      if (!(await isRoomMember(db, roomId, user.email))) return;
      socket.to(roomId).emit("userTypingUpdate", {
        email: user.email,
        isTyping,
      });
    } catch (err) {
      console.error("Typing Update Error:", err);
    }
  });
}

module.exports = { registerChatHandlers };

const {
  consumeRateLimit,
  isRoomMember,
  isValidMessageId,
  isValidRoomId,
  moderateMessage,
} = require("./guards");

function registerChatHandlers(socket, io, { db, messages }) {
  socket.on("sendMessage", async (payload = {}, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const { roomId, message } = payload || {};

    const moderation = moderateMessage(message);
    if (!moderation.ok) {
      respond({ ok: false, error: moderation.error });
      return;
    }
    if (!isValidRoomId(roomId)) {
      respond({ ok: false, error: "Invalid room." });
      return;
    }
    if (!consumeRateLimit(socket, "sendMessage", 8, 10_000)) {
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

      const now = new Date().toISOString();
      const messageData = {
        email: user.email,
        uid: user.uid,
        message: moderation.text,
        timestamp: now,
        deleted: false,
        edited: false,
      };

      const savedMessage = await db
        .collection("rooms")
        .doc(roomId)
        .collection("messages")
        .add(messageData);

      // Touch room lastActivity for metadata / sorting
      await db
        .collection("rooms")
        .doc(roomId)
        .set({ lastActivity: now }, { merge: true });

      const deliveredMessage = { id: savedMessage.id, ...messageData };
      io.to(roomId).emit("receiveMessage", deliveredMessage);
      respond({ ok: true, message: deliveredMessage });
    } catch (err) {
      console.error("Send Message Error:", err);
      respond({
        ok: false,
        error: "Unable to send the message. Please try again.",
      });
    }
  });

  socket.on("editMessage", async (payload = {}, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const { roomId, messageId, message } = payload || {};

    const moderation = moderateMessage(message);
    if (!moderation.ok) {
      respond({ ok: false, error: moderation.error });
      return;
    }
    if (!isValidRoomId(roomId) || !isValidMessageId(messageId)) {
      respond({ ok: false, error: "Invalid room or message." });
      return;
    }
    if (!consumeRateLimit(socket, "editMessage", 10, 30_000)) {
      respond({ ok: false, error: "Too many edit requests. Please wait." });
      return;
    }
    if (!socket.rooms.has(roomId)) {
      respond({ ok: false, error: "Join this room before editing a message." });
      return;
    }

    try {
      const user = socket.data.user;
      if (!(await isRoomMember(db, roomId, user.email))) {
        respond({ ok: false, error: "You do not have access to this room." });
        return;
      }

      const result = await messages.editMessage(
        roomId,
        messageId,
        moderation.text,
        user.email
      );
      if (!result.ok) {
        respond(result);
        return;
      }

      io.to(roomId).emit("messageUpdated", result.message);
      respond({ ok: true, message: result.message });
    } catch (err) {
      console.error("Edit Message Error:", err);
      respond({ ok: false, error: "Unable to edit the message." });
    }
  });

  socket.on("deleteMessage", async (payload = {}, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const { roomId, messageId } = payload || {};

    if (!isValidRoomId(roomId) || !isValidMessageId(messageId)) {
      respond({ ok: false, error: "Invalid room or message." });
      return;
    }
    if (!consumeRateLimit(socket, "deleteMessage", 10, 30_000)) {
      respond({ ok: false, error: "Too many delete requests. Please wait." });
      return;
    }
    if (!socket.rooms.has(roomId)) {
      respond({ ok: false, error: "Join this room before deleting a message." });
      return;
    }

    try {
      const user = socket.data.user;
      if (!(await isRoomMember(db, roomId, user.email))) {
        respond({ ok: false, error: "You do not have access to this room." });
        return;
      }

      const result = await messages.softDeleteMessage(
        roomId,
        messageId,
        user.email
      );
      if (!result.ok) {
        respond(result);
        return;
      }

      io.to(roomId).emit("messageDeleted", {
        id: messageId,
        roomId,
        deletedAt: result.message.deletedAt,
        deletedBy: result.message.deletedBy,
      });
      respond({ ok: true, messageId });
    } catch (err) {
      console.error("Delete Message Error:", err);
      respond({ ok: false, error: "Unable to delete the message." });
    }
  });

  socket.on("typing", async (payload = {}) => {
    const { roomId, isTyping } = payload || {};
    if (!isValidRoomId(roomId) || typeof isTyping !== "boolean") return;
    if (!consumeRateLimit(socket, "typing", 12, 5_000) || !socket.rooms.has(roomId))
      return;

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

  socket.on("searchMessages", async (payload = {}, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const { roomId, query } = payload || {};

    if (!isValidRoomId(roomId)) {
      respond({ ok: false, error: "Invalid room." });
      return;
    }
    if (!consumeRateLimit(socket, "searchMessages", 10, 30_000)) {
      respond({ ok: false, error: "Too many search requests. Please wait." });
      return;
    }
    if (!socket.rooms.has(roomId)) {
      respond({ ok: false, error: "Join this room before searching." });
      return;
    }

    try {
      const user = socket.data.user;
      if (!(await isRoomMember(db, roomId, user.email))) {
        respond({ ok: false, error: "You do not have access to this room." });
        return;
      }

      const result = await messages.searchRoomMessages(roomId, query);
      respond({ ok: true, ...result });
    } catch (err) {
      console.error("Search Messages Error:", err);
      respond({ ok: false, error: "Unable to search messages." });
    }
  });
}

module.exports = { registerChatHandlers };
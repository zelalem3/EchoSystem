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
    const { roomId, description } = payload || {};
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

      let roomMeta = null;

      const authorized = await db.runTransaction(async (transaction) => {
        const memberSnapshot = await transaction.get(memberRef);
        if (memberSnapshot.exists) {
          transaction.set(
            userRoomRef,
            { roomId, lastAccessed: joinedAt },
            { merge: true }
          );
          const roomSnap = await transaction.get(roomRef);
          roomMeta = roomSnap.exists ? roomSnap.data() : null;
          return true;
        }

        const [roomSnapshot, membersSnapshot] = await Promise.all([
          transaction.get(roomRef),
          transaction.get(roomRef.collection("members").limit(1)),
        ]);
        if (roomSnapshot.exists || !membersSnapshot.empty) return false;

        const safeDescription =
          typeof description === "string"
            ? description.trim().slice(0, 280)
            : "";

        roomMeta = {
          createdBy: user.uid,
          createdByEmail: user.email,
          createdAt: joinedAt,
          lastActivity: joinedAt,
          description: safeDescription,
        };

        transaction.create(roomRef, roomMeta);
        transaction.set(memberRef, { email: user.email, joinedAt, role: "owner" });
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
      io.to(roomId).emit(
        "userCountUpdate",
        await presence.addRoomUser(roomId, socket.id)
      );

      const page = await messages.getRoomMessages(roomId);
      socket.emit("chatHistory", { roomId, ...page });
      socket.emit("roomMeta", {
        roomId,
        createdBy: roomMeta?.createdBy || null,
        createdByEmail: roomMeta?.createdByEmail || null,
        createdAt: roomMeta?.createdAt || null,
        lastActivity: roomMeta?.lastActivity || null,
        description: roomMeta?.description || "",
      });
    } catch (err) {
      console.error("Join Room Error:", err);
      socket.emit("roomError", {
        roomId,
        message: "Unable to join the room. Please try again.",
      });
    }
  });

  socket.on("updateRoomMeta", async (payload = {}, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const { roomId, description } = payload || {};
    if (!isValidRoomId(roomId)) {
      respond({ ok: false, error: "Invalid room." });
      return;
    }
    if (!consumeRateLimit(socket, "updateRoomMeta", 5, 60_000)) {
      respond({ ok: false, error: "Too many updates. Please wait." });
      return;
    }

    try {
      const user = socket.data.user;
      const memberSnap = await db
        .collection("rooms")
        .doc(roomId)
        .collection("members")
        .doc(user.email)
        .get();
      if (!memberSnap.exists) {
        respond({ ok: false, error: "You do not have access to this room." });
        return;
      }

      const role = memberSnap.data()?.role;
      const roomSnap = await db.collection("rooms").doc(roomId).get();
      const isOwner =
        role === "owner" ||
        (roomSnap.exists && roomSnap.data()?.createdBy === user.uid);

      if (!isOwner) {
        respond({ ok: false, error: "Only the room owner can update metadata." });
        return;
      }

      const safeDescription =
        typeof description === "string" ? description.trim().slice(0, 280) : "";

      await db.collection("rooms").doc(roomId).set(
        { description: safeDescription },
        { merge: true }
      );

      const meta = {
        roomId,
        description: safeDescription,
        createdBy: roomSnap.data()?.createdBy || null,
        createdByEmail: roomSnap.data()?.createdByEmail || null,
        createdAt: roomSnap.data()?.createdAt || null,
        lastActivity: roomSnap.data()?.lastActivity || null,
      };

      io.to(roomId).emit("roomMeta", meta);
      respond({ ok: true, meta });
    } catch (err) {
      console.error("Update Room Meta Error:", err);
      respond({ ok: false, error: "Unable to update room metadata." });
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
      const page = await messages.getRoomMessages(
        roomId,
        MESSAGE_PAGE_SIZE,
        cursor
      );
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
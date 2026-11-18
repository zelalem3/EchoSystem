const { randomBytes } = require("node:crypto");
const { MESSAGE_PAGE_SIZE } = require("../services/messageService");
const {
  consumeRateLimit,
  getRoomMember,
  isRoomMember,
  isValidRoomId,
} = require("./guards");

const PRESENCE_HEARTBEAT_MS = 20_000;

function registerRoomHandlers(socket, io, { db, messages, presence }) {
  const presenceHeartbeat = setInterval(() => {
    Promise.all(
      [...socket.data.presenceRooms].map((roomId) =>
        presence.refreshRoomUser(roomId, socket.id)
      )
    ).catch((err) => console.error("Presence Heartbeat Error:", err));
  }, PRESENCE_HEARTBEAT_MS);

  async function emitRoomMembers(roomId) {
    const snapshot = await db
      .collection("rooms")
      .doc(roomId)
      .collection("members")
      .limit(100)
      .get();
    io.to(roomId).emit(
      "roomMembersUpdate",
      snapshot.docs.map((doc) => {
        const member = doc.data();
        return {
          email: doc.id,
          ...member,
          mutedUntil:
            member.mutedUntil && Date.parse(member.mutedUntil) <= Date.now()
              ? null
              : member.mutedUntil || null,
        };
      })
    );
  }

  socket.on("joinRoom", async (payload = {}) => {
    const { roomId, description, visibility, inviteCode } = payload || {};
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
      const safeDescription =
        typeof description === "string" ? description.trim().slice(0, 280) : "";
      let roomMeta = null;

      const authorized = await db.runTransaction(async (transaction) => {
        const [memberSnapshot, roomSnapshot] = await Promise.all([
          transaction.get(memberRef),
          transaction.get(roomRef),
        ]);
        if (memberSnapshot.exists && roomSnapshot.exists) {
          roomMeta = roomSnapshot.data();
          transaction.set(
            userRoomRef,
            { roomId, lastAccessed: joinedAt },
            { merge: true }
          );
          return true;
        }

        if (roomSnapshot.exists) {
          roomMeta = roomSnapshot.data();
          const roomVisibility = roomMeta.visibility || "private";
          if (
            roomVisibility !== "public" &&
            (typeof inviteCode !== "string" ||
              inviteCode !== roomMeta.inviteCode)
          ) {
            return false;
          }

          transaction.create(memberRef, {
            email: user.email,
            uid: user.uid,
            displayName: user.displayName || "",
            joinedAt,
            role: "member",
          });
          transaction.set(userRoomRef, { roomId, lastAccessed: joinedAt });
          return true;
        }

        const membersSnapshot = await transaction.get(
          roomRef.collection("members").limit(1)
        );
        if (!membersSnapshot.empty) return false;

        const roomVisibility = visibility === "private" ? "private" : "public";
        roomMeta = {
          createdBy: user.uid,
          createdByEmail: user.email,
          createdAt: joinedAt,
          lastActivity: joinedAt,
          description: safeDescription,
          visibility: roomVisibility,
          ...(roomVisibility === "private"
            ? { inviteCode: randomBytes(9).toString("base64url") }
            : {}),
        };

        transaction.create(roomRef, roomMeta);
        transaction.set(memberRef, {
          email: user.email,
          uid: user.uid,
          displayName: user.displayName || "",
          joinedAt,
          role: "owner",
        });
        transaction.set(userRoomRef, { roomId, lastAccessed: joinedAt });
        return true;
      });

      if (!authorized) {
        socket.emit("roomError", {
          roomId,
          message: "You do not have access to this room. Check the invite code.",
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
      const member = (await getRoomMember(db, roomId, user.email)).data();
      socket.emit("chatHistory", { roomId, ...page });
      socket.emit("roomMeta", {
        roomId,
        createdBy: roomMeta?.createdBy || null,
        createdByEmail: roomMeta?.createdByEmail || null,
        createdAt: roomMeta?.createdAt || null,
        lastActivity: roomMeta?.lastActivity || null,
        description: roomMeta?.description || "",
        visibility: roomMeta?.visibility || "private",
        inviteCode:
          roomMeta?.visibility === "private" ? roomMeta.inviteCode || null : null,
        role: member?.role || "member",
      });
      await emitRoomMembers(roomId);
    } catch (err) {
      console.error("Join Room Error:", err);
      socket.emit("roomError", {
        roomId,
        message: "Unable to join the room. Please try again.",
      });
    }
  });

  socket.on("manageRoomMember", async (payload = {}, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const { roomId, email: targetEmail, action } = payload || {};
    if (
      !isValidRoomId(roomId) ||
      typeof targetEmail !== "string" ||
      targetEmail.length > 254 ||
      !["promote", "demote", "kick", "mute", "unmute"].includes(action)
    ) {
      respond({ ok: false, error: "Invalid moderation request." });
      return;
    }
    if (!consumeRateLimit(socket, "manageRoomMember", 10, 60_000)) {
      respond({ ok: false, error: "Too many moderation requests. Please wait." });
      return;
    }

    try {
      const user = socket.data.user;
      const roomRef = db.collection("rooms").doc(roomId);
      const actorRef = roomRef.collection("members").doc(user.email);
      const targetRef = roomRef.collection("members").doc(targetEmail);
      let updatedRole = null;
      let kicked = false;

      const result = await db.runTransaction(async (transaction) => {
        const [roomSnapshot, actorSnapshot, targetSnapshot] = await Promise.all([
          transaction.get(roomRef),
          transaction.get(actorRef),
          transaction.get(targetRef),
        ]);
        if (!roomSnapshot.exists || !actorSnapshot.exists || !targetSnapshot.exists) {
          return { ok: false, error: "Room member not found." };
        }

        const actor = actorSnapshot.data();
        const target = targetSnapshot.data();
        const owner =
          actor.role === "owner" || roomSnapshot.data()?.createdBy === user.uid;
        const admin = owner || actor.role === "admin";
        const targetIsOwner =
          target.role === "owner" ||
          roomSnapshot.data()?.createdBy === target.uid;
        const targetIsAdmin = target.role === "admin" || targetIsOwner;

        if (!admin) return { ok: false, error: "Only room admins can moderate." };
        if (targetEmail === user.email || targetIsOwner) {
          return { ok: false, error: "You cannot moderate this member." };
        }
        if (!owner && targetIsAdmin) {
          return { ok: false, error: "Admins can only moderate members." };
        }
        if ((action === "promote" || action === "demote") && !owner) {
          return { ok: false, error: "Only the owner can change admin roles." };
        }

        if (action === "promote") {
          if (target.role === "admin") {
            return { ok: false, error: "This member is already an admin." };
          }
          updatedRole = "admin";
          transaction.update(targetRef, { role: updatedRole });
        } else if (action === "demote") {
          if (target.role !== "admin") {
            return { ok: false, error: "Only admins can be demoted." };
          }
          updatedRole = "member";
          transaction.update(targetRef, { role: updatedRole });
        } else if (action === "kick") {
          kicked = true;
          transaction.delete(targetRef);
          transaction.delete(
            db
              .collection("users")
              .doc(targetEmail)
              .collection("joined_rooms")
              .doc(roomId)
          );
        } else {
          transaction.update(targetRef, {
            mutedUntil:
              action === "mute"
                ? new Date(Date.now() + 15 * 60_000).toISOString()
                : null,
          });
        }
        return { ok: true };
      });

      if (!result.ok) {
        respond(result);
        return;
      }

      if (kicked) {
        const targetSockets = await io.in(roomId).fetchSockets();
        const kickedSockets = targetSockets.filter(
          (targetSocket) => targetSocket.data.user?.email === targetEmail
        );
        for (const targetSocket of kickedSockets) {
          targetSocket.emit("roomKicked", { roomId });
          await targetSocket.leave(roomId);
          targetSocket.data.presenceRooms?.delete(roomId);
          await presence.removeRoomUser(roomId, targetSocket.id);
        }
        io.to(roomId).emit(
          "userCountUpdate",
          await presence.getRoomUserCount(roomId)
        );
      }

      await emitRoomMembers(roomId);
      respond({ ok: true, role: updatedRole });
    } catch (err) {
      console.error("Manage Room Member Error:", err);
      respond({ ok: false, error: "Unable to update room membership." });
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
      await db
        .collection("rooms")
        .doc(roomId)
        .set({ description: safeDescription }, { merge: true });

      const meta = {
        roomId,
        description: safeDescription,
        createdBy: roomSnap.data()?.createdBy || null,
        createdByEmail: roomSnap.data()?.createdByEmail || null,
        createdAt: roomSnap.data()?.createdAt || null,
        lastActivity: roomSnap.data()?.lastActivity || null,
        visibility: roomSnap.data()?.visibility || "private",
        inviteCode:
          roomSnap.data()?.visibility === "private"
            ? roomSnap.data()?.inviteCode || null
            : null,
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

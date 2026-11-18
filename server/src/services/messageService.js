const MESSAGE_PAGE_SIZE = 30;

function createMessageService(db) {
  async function getRoomMessages(roomId, limit = MESSAGE_PAGE_SIZE, cursor = null) {
    const messagesRef = db.collection("rooms").doc(roomId).collection("messages");
    // Prefer non-deleted messages. Fall back if the composite index is not ready yet.
    let query = messagesRef.orderBy("timestamp", "desc").limit(limit + 1);

    if (cursor) {
      const cursorSnapshot = await messagesRef.doc(cursor).get();
      if (!cursorSnapshot.exists) {
        throw new Error("Message pagination cursor was not found");
      }
      query = query.startAfter(cursorSnapshot);
    }

    const snapshot = await query.get();
    const filtered = snapshot.docs.filter((doc) => doc.data().deleted !== true);
    const hasMore = snapshot.docs.length > limit;
    const pageDocs = filtered.slice(0, limit);
    const nextCursor =
      hasMore && snapshot.docs.length > limit
        ? snapshot.docs[limit - 1]?.id || null
        : hasMore
          ? snapshot.docs[snapshot.docs.length - 1]?.id || null
          : null;

    return {
      messages: [...pageDocs].reverse().map((doc) => ({ id: doc.id, ...doc.data() })),
      cursor: nextCursor,
      hasMore,
    };
  }

  /**
   * Search messages in a room by text (in-memory filter over a recent window).
   * Fine for MVP room sizes; replace with a full-text index later if needed.
   */
  async function searchRoomMessages(roomId, queryText, limit = 50) {
    const q = typeof queryText === "string" ? queryText.trim().toLowerCase() : "";
    if (!q || q.length < 2) {
      return { messages: [], query: q };
    }

    const snapshot = await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .orderBy("timestamp", "desc")
      .limit(500)
      .get();

    const matches = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.deleted === true) continue;
      const text = (data.message || "").toLowerCase();
      if (text.includes(q)) {
        matches.push({ id: doc.id, ...data });
        if (matches.length >= limit) break;
      }
    }

    matches.reverse();
    return { messages: matches, query: q };
  }

  async function softDeleteMessage(roomId, messageId, actorEmail) {
    const ref = db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .doc(messageId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { ok: false, error: "Message not found." };
      }
      const data = snap.data();
      if (data.deleted === true) {
        return { ok: false, error: "Message is already deleted." };
      }
      if (data.email !== actorEmail) {
        return { ok: false, error: "You can only delete your own messages." };
      }

      const deletedAt = new Date().toISOString();
      tx.update(ref, {
        deleted: true,
        deletedAt,
        deletedBy: actorEmail,
        message: "",
      });

      return {
        ok: true,
        message: {
          id: messageId,
          ...data,
          deleted: true,
          deletedAt,
          deletedBy: actorEmail,
          message: "",
        },
      };
    });
  }

  async function editMessage(roomId, messageId, newText, actorEmail) {
    const ref = db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .doc(messageId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { ok: false, error: "Message not found." };
      }
      const data = snap.data();
      if (data.deleted === true) {
        return { ok: false, error: "Cannot edit a deleted message." };
      }
      if (data.email !== actorEmail) {
        return { ok: false, error: "You can only edit your own messages." };
      }

      const editedAt = new Date().toISOString();
      tx.update(ref, {
        message: newText,
        editedAt,
        edited: true,
      });

      return {
        ok: true,
        message: {
          id: messageId,
          ...data,
          message: newText,
          editedAt,
          edited: true,
        },
      };
    });
  }

  async function addMessageReceipt(roomId, messageId, email, status) {
    if (!["deliveredTo", "readBy"].includes(status)) {
      return { ok: false, error: "Invalid receipt status." };
    }

    const ref = db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .doc(messageId);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, error: "Message not found." };
      const data = snap.data();
      if (data.deleted === true || data.email === email) {
        return { ok: false, error: "Receipt is not applicable." };
      }

      const deliveredTo = new Set(
        Array.isArray(data.deliveredTo) ? data.deliveredTo : []
      );
      const readBy = new Set(Array.isArray(data.readBy) ? data.readBy : []);
      deliveredTo.add(email);
      if (status === "readBy") readBy.add(email);

      const updated = {
        deliveredTo: [...deliveredTo],
        readBy: [...readBy],
      };
      tx.update(ref, updated);
      return { ok: true, receipt: { id: messageId, ...updated } };
    });
  }

  return {
    getRoomMessages,
    searchRoomMessages,
    softDeleteMessage,
    editMessage,
    addMessageReceipt,
  };
}

module.exports = { createMessageService, MESSAGE_PAGE_SIZE };
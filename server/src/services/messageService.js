const MESSAGE_PAGE_SIZE = 3;

function createMessageService(db) {
  async function getRoomMessages(roomId, limit = MESSAGE_PAGE_SIZE, cursor = null) {
    const messagesRef = db.collection("rooms").doc(roomId).collection("messages");
    let query = messagesRef.orderBy("timestamp", "desc").limit(limit + 1);

    if (cursor) {
      const cursorSnapshot = await messagesRef.doc(cursor).get();
      if (!cursorSnapshot.exists) {
        throw new Error("Message pagination cursor was not found");
      }
      query = query.startAfter(cursorSnapshot);
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const pageDocs = snapshot.docs.slice(0, limit);
    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : null;

    return {
      messages: [...pageDocs].reverse().map((doc) => ({ id: doc.id, ...doc.data() })),
      cursor: nextCursor,
      hasMore,
    };
  }

  return { getRoomMessages };
}

module.exports = { createMessageService, MESSAGE_PAGE_SIZE };

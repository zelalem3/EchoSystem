const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const MAX_MESSAGE_LENGTH = 2_000;

function isValidRoomId(roomId) {
  return typeof roomId === "string" && ROOM_ID_PATTERN.test(roomId);
}

function isRoomMember(db, roomId, email) {
  return db
    .collection("rooms")
    .doc(roomId)
    .collection("members")
    .doc(email)
    .get()
    .then((snapshot) => snapshot.exists);
}

function consumeRateLimit(socket, event, limit, windowMs) {
  if (!socket.data.rateLimits) socket.data.rateLimits = new Map();
  const now = Date.now();
  const recentEvents = (socket.data.rateLimits.get(event) || []).filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (recentEvents.length >= limit) {
    socket.data.rateLimits.set(event, recentEvents);
    return false;
  }
  recentEvents.push(now);
  recentEvents.push(now);
  socket.data.rateLimits.set(event, recentEvents);
  return true;
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  consumeRateLimit,
  isRoomMember,
  isValidRoomId,
};

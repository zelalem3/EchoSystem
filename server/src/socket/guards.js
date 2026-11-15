const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const MAX_MESSAGE_LENGTH = 2_000;
const MESSAGE_ID_PATTERN = /^[a-zA-Z0-9]{1,1500}$/;

/** Simple blocklist for basic content moderation (case-insensitive substring match). */
const BLOCKED_TERMS = [
  // Keep this list short and focused; expand carefully to avoid false positives.
];

function isValidRoomId(roomId) {
  return typeof roomId === "string" && ROOM_ID_PATTERN.test(roomId);
}

function isValidMessageId(messageId) {
  return typeof messageId === "string" && MESSAGE_ID_PATTERN.test(messageId);
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

/**
 * Sliding-window rate limiter stored on the socket.
 * Returns true if the event is allowed, false if the limit was exceeded.
 */
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
  socket.data.rateLimits.set(event, recentEvents);
  return true;
}

/**
 * Basic content moderation: empty check, length, and optional blocklist.
 * Returns { ok: true, text } or { ok: false, error: string }.
 */
function moderateMessage(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "Message must be text." };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Message cannot be empty." };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
    };
  }

  // Collapse excessive repeated characters that look like spam
  if (/(.)\1{40,}/.test(trimmed)) {
    return { ok: false, error: "Message looks like spam." };
  }

  const lower = trimmed.toLowerCase();
  for (const term of BLOCKED_TERMS) {
    if (term && lower.includes(term.toLowerCase())) {
      return { ok: false, error: "Message contains blocked content." };
    }
  }

  return { ok: true, text: trimmed };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  BLOCKED_TERMS,
  consumeRateLimit,
  isRoomMember,
  isValidMessageId,
  isValidRoomId,
  moderateMessage,
};
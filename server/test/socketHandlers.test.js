const assert = require("node:assert/strict");
const test = require("node:test");
const { registerChatHandlers } = require("../src/socket/chatHandlers");
const { registerRoomHandlers } = require("../src/socket/roomHandlers");
const {
  consumeRateLimit,
  isValidRoomId,
} = require("../src/socket/guards");

function createSocket({
  isMember = true,
  persistMessage = async () => ({ id: "message-1" }),
  user = { uid: "user-1", email: "user@example.com" },
} = {}) {
  const handlers = new Map();
  const socket = {
    data: { user },
    rooms: new Set(["general"]),
    on: (event, handler) => handlers.set(event, handler),
  };
  const db = {
    collection: () => ({
      doc: () => ({
        collection: (name) => {
          if (name === "members") {
            return {
              doc: () => ({ get: async () => ({ exists: isMember }) }),
            };
          }
          return { add: persistMessage };
        },
      }),
    }),
  };
  const broadcasts = [];
  const io = {
    to: (roomId) => ({
      emit: (event, payload) => broadcasts.push({ roomId, event, payload }),
    }),
  };

  registerChatHandlers(socket, io, db);
  return { broadcasts, db, handlers, socket };
}

function createRoomHarness({ memberExists = false, roomExists = false, hasMembers = false } = {}) {
  const handlers = new Map();
  const writes = [];
  const roomRef = {
    type: "room",
    collection: () => ({
      doc: (email) => ({ type: "member", email }),
      limit: () => ({ type: "membersQuery" }),
    }),
  };
  const db = {
    collection: (name) => {
      if (name === "rooms") return { doc: () => roomRef };
      return {
        doc: (email) => ({
          collection: () => ({
            doc: (roomId) => ({ type: "userRoom", email, roomId }),
          }),
        }),
      };
    },
    runTransaction: (callback) =>
      callback({
        get: async (ref) => {
          if (ref.type === "member") return { exists: memberExists };
          if (ref.type === "room") return { exists: roomExists };
          return { empty: !hasMembers };
        },
        create: (ref, value) => writes.push({ operation: "create", ref, value }),
        set: (ref, value) => writes.push({ operation: "set", ref, value }),
      }),
  };
  const emitted = [];
  const socket = {
    data: {
      user: { uid: "user-1", email: "user@example.com" },
      presenceRooms: new Set(),
    },
    id: "socket-1",
    rooms: new Set(["socket-1"]),
    on: (event, handler) => handlers.set(event, handler),
    emit: (event, payload) => emitted.push({ event, payload }),
    join: async (roomId) => socket.rooms.add(roomId),
  };
  const io = { to: () => ({ emit: () => {} }) };
  const presence = {
    addRoomUser: async () => 1,
    refreshRoomUser: async () => {},
  };
  const messages = { getRoomMessages: async () => ({ messages: [], cursor: null, hasMore: false }) };
  const clearHeartbeat = registerRoomHandlers(socket, io, { db, messages, presence });

  return { clearHeartbeat, db, emitted, handlers, socket, writes };
}

test("validates room IDs", () => {
  assert.equal(isValidRoomId("team-room_1.test"), true);
  assert.equal(isValidRoomId("../private"), false);
  assert.equal(isValidRoomId(""), false);
  assert.equal(isValidRoomId("a".repeat(65)), false);
});

test("limits events within a socket window", () => {
  const socket = { data: {} };

  assert.equal(consumeRateLimit(socket, "typing", 1, 5_000), true);
  assert.equal(consumeRateLimit(socket, "typing", 1, 5_000), false);
});

test("persists and broadcasts a message with its ID before acknowledging success", async () => {
  const { broadcasts, handlers } = createSocket();
  let acknowledgement;

  await handlers.get("sendMessage")(
    { roomId: "general", message: "  hello  ", user: { email: "forged@example.com" } },
    (result) => {
      acknowledgement = result;
    }
  );

  assert.equal(acknowledgement.ok, true);
  assert.equal(acknowledgement.message.id, "message-1");
  assert.equal(acknowledgement.message.email, "user@example.com");
  assert.equal(acknowledgement.message.message, "hello");
  assert.equal(broadcasts[0].payload.id, "message-1");
  assert.equal(broadcasts[0].payload.email, "user@example.com");
});

test("rejects messages from non-members without persisting", async () => {
  let persisted = false;
  const { handlers } = createSocket({
    isMember: false,
    persistMessage: async () => {
      persisted = true;
      return { id: "message-1" };
    },
  });
  let acknowledgement;

  await handlers.get("sendMessage")(
    { roomId: "general", message: "hello" },
    (result) => {
      acknowledgement = result;
    }
  );

  assert.equal(acknowledgement.ok, false);
  assert.equal(persisted, false);
});

test("returns a clear failure acknowledgement when persistence fails", async () => {
  const { db, handlers } = createSocket();
  db.collection = () => ({
    doc: () => ({
      collection: (name) => {
        if (name === "members") {
          return { doc: () => ({ get: async () => ({ exists: true }) }) };
        }
        return { add: async () => { throw new Error("Firestore unavailable"); } };
      },
    }),
  });
  const originalError = console.error;
  console.error = () => {};
  let acknowledgement;

  try {
    await handlers.get("sendMessage")(
      { roomId: "general", message: "hello" },
      (result) => {
        acknowledgement = result;
      }
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(acknowledgement.ok, false);
  assert.match(acknowledgement.error, /Unable to send/);
});

test("allows a user to claim an unused room and adds them as a member", async () => {
  const { clearHeartbeat, emitted, handlers, socket, writes } = createRoomHarness();

  try {
    await handlers.get("joinRoom")({ roomId: "new-room" });
  } finally {
    clearHeartbeat();
  }

  assert.equal(socket.rooms.has("new-room"), true);
  assert.ok(socket.data.presenceRooms.has("new-room"));
  assert.equal(writes.some((write) => write.operation === "create"), true);
  assert.equal(writes.some((write) => write.ref.type === "member"), true);
  assert.ok(emitted.some((event) => event.event === "chatHistory"));
});

test("denies joining an existing room without membership", async () => {
  const { clearHeartbeat, emitted, handlers, socket } = createRoomHarness({
    roomExists: true,
    hasMembers: true,
  });

  try {
    await handlers.get("joinRoom")({ roomId: "private-room" });
  } finally {
    clearHeartbeat();
  }

  assert.equal(socket.rooms.has("private-room"), false);
  assert.ok(
    emitted.some(
      (event) =>
        event.event === "roomError" &&
        event.payload.message === "You do not have access to this room."
    )
  );
});

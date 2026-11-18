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
  memberData = {},
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
              doc: () => ({
                get: async () => ({ exists: isMember, data: () => memberData }),
              }),
            };
          }
          return { add: persistMessage };
        },
        set: async () => {},
      }),
    }),
  };
  const broadcasts = [];
  const io = {
    to: (roomId) => ({
      emit: (event, payload) => broadcasts.push({ roomId, event, payload }),
    }),
  };

  registerChatHandlers(socket, io, { db, messages: {} });
  return { broadcasts, db, handlers, socket };
}

function createRoomHarness({
  memberExists = false,
  roomExists = false,
  hasMembers = false,
  roomMeta = {},
} = {}) {
  const handlers = new Map();
  const writes = [];
  const roomRef = {
    type: "room",
    collection: () => ({
      doc: (email) => ({
        type: "member",
        email,
        get: async () => ({
          exists: true,
          data: () => ({ role: "owner" }),
        }),
      }),
      limit: () => ({
        type: "membersQuery",
        get: async () => ({ docs: [] }),
      }),
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
          if (writes.length) {
            throw new Error("Transaction reads must precede writes.");
          }
          if (ref.type === "member") return { exists: memberExists };
          if (ref.type === "room") {
            return { exists: roomExists, data: () => roomMeta };
          }
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

function createModerationHarness({
  actorRole,
  targetRole,
}) {
  const handlers = new Map();
  const actorEmail = "actor@example.com";
  const targetEmail = "target@example.com";
  const members = new Map([
    [actorEmail, { email: actorEmail, role: actorRole }],
    [targetEmail, { email: targetEmail, role: targetRole }],
  ]);
  const roomRef = {
    type: "room",
    collection: () => ({
      doc: (email) => ({ type: "member", email }),
      limit: () => ({
        get: async () => ({
          docs: [...members.entries()].map(([email, data]) => ({
            id: email,
            data: () => data,
          })),
        }),
      }),
    }),
  };
  const db = {
    collection: (name) =>
      name === "rooms"
        ? { doc: () => roomRef }
        : {
            doc: () => ({
              collection: () => ({ doc: () => ({ type: "userRoom" }) }),
            }),
          },
    runTransaction: (callback) =>
      callback({
        get: async (ref) =>
          ref.type === "room"
            ? {
                exists: true,
                  data: () => ({
                    createdBy: actorRole === "owner" ? "actor-uid" : "owner-uid",
                  }),
              }
            : {
                exists: members.has(ref.email),
                data: () => members.get(ref.email),
              },
        update: (ref, values) =>
          members.set(ref.email, { ...members.get(ref.email), ...values }),
        delete: (ref) => members.delete(ref.email),
      }),
  };
  const socket = {
    data: {
      user: { uid: "actor-uid", email: actorEmail },
      presenceRooms: new Set(["moderated-room"]),
    },
    id: "actor-socket",
    rooms: new Set(["moderated-room"]),
    on: (event, handler) => handlers.set(event, handler),
  };
  const io = {
    to: () => ({ emit: () => {} }),
    in: () => ({ fetchSockets: async () => [] }),
  };
  const presence = {
    refreshRoomUser: async () => {},
    removeRoomUser: async () => 0,
    getRoomUserCount: async () => 0,
  };
  const clearHeartbeat = registerRoomHandlers(socket, io, {
    db,
    messages: {},
    presence,
  });
  return {
    actorEmail,
    clearHeartbeat,
    handlers,
    members,
    targetEmail,
  };
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

test("rejects messages from muted room members", async () => {
  let persisted = false;
  const { handlers } = createSocket({
    memberData: { mutedUntil: new Date(Date.now() + 60_000).toISOString() },
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
  assert.match(acknowledgement.error, /muted/);
  assert.equal(persisted, false);
});

test("returns a clear failure acknowledgement when persistence fails", async () => {
  const { db, handlers } = createSocket();
  db.collection = () => ({
    doc: () => ({
      collection: (name) => {
        if (name === "members") {
          return {
            doc: () => ({
              get: async () => ({ exists: true, data: () => ({}) }),
            }),
          };
        }
        return { add: async () => { throw new Error("Firestore unavailable"); } };
      },
      set: async () => {},
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

test("creates private rooms with an owner and an invite code", async () => {
  const { clearHeartbeat, emitted, handlers, writes } = createRoomHarness();

  try {
    await handlers.get("joinRoom")({
      roomId: "private-room",
      visibility: "private",
    });
  } finally {
    clearHeartbeat();
  }

  const room = writes.find((write) => write.ref.type === "room")?.value;
  const owner = writes.find((write) => write.ref.type === "member")?.value;
  assert.equal(room.visibility, "private");
  assert.match(room.inviteCode, /^[\w-]{12}$/);
  assert.equal(owner.role, "owner");
  assert.equal(
    emitted.find((event) => event.event === "roomMeta")?.payload.inviteCode,
    room.inviteCode
  );
});

test("allows non-members to join public rooms", async () => {
  const { clearHeartbeat, emitted, handlers, socket, writes } =
    createRoomHarness({
      roomExists: true,
      hasMembers: true,
      roomMeta: { visibility: "public" },
    });

  try {
    await handlers.get("joinRoom")({ roomId: "public-room" });
  } finally {
    clearHeartbeat();
  }

  assert.equal(socket.rooms.has("public-room"), true);
  assert.ok(writes.some((write) => write.ref.type === "member"));
  assert.equal(
    emitted.find((event) => event.event === "roomMeta")?.payload.visibility,
    "public"
  );
});

test("requires a matching invite code to join private rooms", async () => {
  const denied = createRoomHarness({
    roomExists: true,
    hasMembers: true,
    roomMeta: { visibility: "private", inviteCode: "valid-code" },
  });
  try {
    await denied.handlers.get("joinRoom")({
      roomId: "private-room",
      inviteCode: "wrong-code",
    });
  } finally {
    denied.clearHeartbeat();
  }
  assert.equal(denied.socket.rooms.has("private-room"), false);

  const allowed = createRoomHarness({
    roomExists: true,
    hasMembers: true,
    roomMeta: { visibility: "private", inviteCode: "valid-code" },
  });
  try {
    await allowed.handlers.get("joinRoom")({
      roomId: "private-room",
      inviteCode: "valid-code",
    });
  } finally {
    allowed.clearHeartbeat();
  }
  assert.equal(allowed.socket.rooms.has("private-room"), true);
});

test("admins cannot moderate other admins", async () => {
  const harness = createModerationHarness({
    actorRole: "admin",
    targetRole: "admin",
  });
  let acknowledgement;
  try {
    await harness.handlers.get("manageRoomMember")(
      {
        roomId: "moderated-room",
        email: harness.targetEmail,
        action: "kick",
      },
      (result) => {
        acknowledgement = result;
      }
    );
  } finally {
    harness.clearHeartbeat();
  }

  assert.equal(acknowledgement.ok, false);
  assert.match(acknowledgement.error, /only moderate members/i);
  assert.equal(harness.members.has(harness.targetEmail), true);
});

test("owners can promote room members to admin", async () => {
  const harness = createModerationHarness({
    actorRole: "owner",
    targetRole: "member",
  });
  let acknowledgement;
  try {
    await harness.handlers.get("manageRoomMember")(
      {
        roomId: "moderated-room",
        email: harness.targetEmail,
        action: "promote",
      },
      (result) => {
        acknowledgement = result;
      }
    );
  } finally {
    harness.clearHeartbeat();
  }

  assert.equal(acknowledgement.ok, true);
  assert.equal(harness.members.get(harness.targetEmail).role, "admin");
});

test("allows an existing member to rejoin and load room metadata", async () => {
  const roomMeta = {
    createdBy: "user-1",
    createdByEmail: "user@example.com",
    description: "Existing room",
  };
  const { clearHeartbeat, emitted, handlers, socket, writes } =
    createRoomHarness({ memberExists: true, roomExists: true, roomMeta });

  try {
    await handlers.get("joinRoom")({ roomId: "existing-room" });
  } finally {
    clearHeartbeat();
  }

  assert.equal(socket.rooms.has("existing-room"), true);
  assert.ok(writes.some((write) => write.ref.type === "userRoom"));
  assert.ok(emitted.some((event) => event.event === "chatHistory"));
  assert.deepEqual(
    emitted.find((event) => event.event === "roomMeta")?.payload,
    {
      roomId: "existing-room",
      createdBy: "user-1",
      createdByEmail: "user@example.com",
      createdAt: null,
      lastActivity: null,
      description: "Existing room",
      visibility: "private",
      inviteCode: null,
      role: "owner",
    }
  );
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
        event.payload.message.startsWith("You do not have access to this room.")
    )
  );
});

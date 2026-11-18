const assert = require("node:assert/strict");
const test = require("node:test");
const { createMessageService } = require("../src/services/messageService");

function createMessageHarness(message) {
  const storedMessage = { ...message };
  const messageRef = { id: "message-1" };
  const db = {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => messageRef,
        }),
      }),
    }),
    runTransaction: (callback) =>
      callback({
        get: async () => ({
          exists: true,
          data: () => ({ ...storedMessage }),
        }),
        update: (_ref, values) => Object.assign(storedMessage, values),
      }),
  };
  return {
    messages: createMessageService(db),
    storedMessage,
  };
}

test("read receipts also mark a message delivered and remain unique", async () => {
  const { messages, storedMessage } = createMessageHarness({
    email: "author@example.com",
    deliveredTo: [],
    readBy: [],
  });

  await messages.addMessageReceipt(
    "general",
    "message-1",
    "reader@example.com",
    "deliveredTo"
  );
  await messages.addMessageReceipt(
    "general",
    "message-1",
    "reader@example.com",
    "readBy"
  );

  assert.deepEqual(storedMessage.deliveredTo, ["reader@example.com"]);
  assert.deepEqual(storedMessage.readBy, ["reader@example.com"]);
});

test("does not add receipts to a sender's own message", async () => {
  const { messages, storedMessage } = createMessageHarness({
    email: "author@example.com",
    deliveredTo: [],
    readBy: [],
  });

  const result = await messages.addMessageReceipt(
    "general",
    "message-1",
    "author@example.com",
    "readBy"
  );

  assert.equal(result.ok, false);
  assert.deepEqual(storedMessage.deliveredTo, []);
  assert.deepEqual(storedMessage.readBy, []);
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { moderateMessage, isValidRoomId, isValidMessageId } = require("../src/socket/guards");

test("moderateMessage rejects empty", () => {
  assert.equal(moderateMessage("   ").ok, false);
});

test("moderateMessage accepts normal text", () => {
  const result = moderateMessage(" hello world ");
  assert.equal(result.ok, true);
  assert.equal(result.text, "hello world");
});

test("isValidRoomId", () => {
  assert.equal(isValidRoomId("general"), true);
  assert.equal(isValidRoomId("../hack"), false);
});

test("isValidMessageId", () => {
  assert.equal(isValidMessageId("abc123XYZ"), true);
  assert.equal(isValidMessageId("a/b"), false);
});
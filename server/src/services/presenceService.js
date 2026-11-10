const PRESENCE_TTL_MS = 60_000;
const PRESENCE_KEY_PREFIX = "echosystem:presence:";

function createPresenceService(redisClient) {
  const localRoomUsers = new Map();

  function getPresenceKey(roomId) {
    return `${PRESENCE_KEY_PREFIX}${encodeURIComponent(roomId)}`;
  }

  async function getRoomUserCount(roomId) {
    if (redisClient) {
      const key = getPresenceKey(roomId);
      await redisClient.zRemRangeByScore(key, 0, Date.now() - PRESENCE_TTL_MS);
      const count = await redisClient.zCard(key);
      if (count === 0) await redisClient.del(key);
      return count;
    }

    return localRoomUsers.get(roomId)?.size || 0;
  }

  async function addRoomUser(roomId, socketId) {
    if (redisClient) {
      const key = getPresenceKey(roomId);
      await redisClient.zAdd(key, { score: Date.now(), value: socketId });
      await redisClient.pExpire(key, PRESENCE_TTL_MS * 2);
      return getRoomUserCount(roomId);
    }

    if (!localRoomUsers.has(roomId)) localRoomUsers.set(roomId, new Set());
    const users = localRoomUsers.get(roomId);
    users.add(socketId);
    return users.size;
  }

  async function removeRoomUser(roomId, socketId) {
    if (redisClient) {
      const key = getPresenceKey(roomId);
      await redisClient.zRem(key, socketId);
      return getRoomUserCount(roomId);
    }

    const users = localRoomUsers.get(roomId);
    if (!users) return 0;

    users.delete(socketId);
    if (users.size === 0) localRoomUsers.delete(roomId);
    return users.size;
  }

  async function refreshRoomUser(roomId, socketId) {
    if (!redisClient) return;

    const key = getPresenceKey(roomId);
    await redisClient.zAdd(key, { score: Date.now(), value: socketId });
    await redisClient.pExpire(key, PRESENCE_TTL_MS * 2);
  }

  return { addRoomUser, removeRoomUser, refreshRoomUser };
}

module.exports = { createPresenceService };

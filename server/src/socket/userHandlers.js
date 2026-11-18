const { isRoomMember, isValidRoomId } = require("./guards");

function registerUserHandlers(socket, db) {
  socket.on("getProfile", async (acknowledge) => {
    try {
      const { email, displayName } = socket.data.user;
      const snapshot = await db.collection("users").doc(email).get();
      const profile = snapshot.data() || {};
      socket.data.user.displayName = profile.displayName || displayName || "";
      if (typeof acknowledge === "function") {
        acknowledge({
          ok: true,
          profile: {
            displayName: profile.displayName || displayName || "",
            bio: profile.bio || "",
          },
        });
      }
    } catch (err) {
      console.error("Fetch Profile Error:", err);
      if (typeof acknowledge === "function") {
        acknowledge({ ok: false, error: "Unable to load your profile." });
      }
    }
  });

  socket.on("updateProfile", async (payload = {}, acknowledge) => {
    const respond = (result) => {
      if (typeof acknowledge === "function") acknowledge(result);
    };
    const profileData = payload && typeof payload === "object" ? payload : {};
    const displayName =
      typeof profileData.displayName === "string"
        ? profileData.displayName.trim()
        : "";
    const bio =
      typeof profileData.bio === "string" ? profileData.bio.trim() : "";
    if (!displayName || displayName.length > 60 || bio.length > 280) {
      respond({ ok: false, error: "Name must be 1-60 characters; bio up to 280." });
      return;
    }

    try {
      const { email } = socket.data.user;
      await db
        .collection("users")
        .doc(email)
        .set({ displayName, bio }, { merge: true });
      socket.data.user.displayName = displayName;

      const rooms = await db
        .collection("users")
        .doc(email)
        .collection("joined_rooms")
        .get();
      await Promise.all(
        rooms.docs.map((room) => {
          const roomId = room.data().roomId;
          if (!isValidRoomId(roomId)) return Promise.resolve();
          return db
            .collection("rooms")
            .doc(roomId)
            .collection("members")
            .doc(email)
            .set({ displayName }, { merge: true });
        })
      );
      respond({ ok: true, profile: { displayName, bio } });
    } catch (err) {
      console.error("Update Profile Error:", err);
      respond({ ok: false, error: "Unable to save your profile." });
    }
  });

  socket.on("getUserRooms", async () => {
    try {
      const { email } = socket.data.user;
      const snapshot = await db
        .collection("users")
        .doc(email)
        .collection("joined_rooms")
        .get();
      const rooms = (
        await Promise.all(
          snapshot.docs.map(async (doc) => {
            const roomId = doc.data().roomId;
            if (!isValidRoomId(roomId)) return null;
            return (await isRoomMember(db, roomId, email)) ? roomId : null;
          })
        )
      ).filter(Boolean);
      socket.emit("userRoomsList", rooms);
    } catch (err) {
      console.error("Fetch Rooms Error:", err);
    }
  });
}

module.exports = { registerUserHandlers };

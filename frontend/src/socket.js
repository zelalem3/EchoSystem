import { io } from "socket.io-client";
import { auth } from "./firebase";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV
    ? "http://localhost:10000"
    : "https://echosystem-1.onrender.com");

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
  auth: (callback) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      callback({});
      return;
    }

    currentUser
      .getIdToken()
      .then((token) => callback({ token }))
      .catch((error) => {
        console.error("Unable to retrieve Firebase ID token:", error);
        callback({});
      });
  },
});

export const connectSocket = () => {
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = () => {
  if (socket.connected) socket.disconnect();
};

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("Connection Error:", err.message);
});

socket.on("disconnect", () => {
  console.log("Socket disconnected");
});
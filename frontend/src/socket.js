import { io } from "socket.io-client";

// Use an Environment Variable (best practice for Vite/React)
// In Vercel, set VITE_SERVER_URL to your Render link
const SERVER_URL = "https://echosystem-1.onrender.com" || "http://localhost:10000";

export const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"], 
  withCredentials: true
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
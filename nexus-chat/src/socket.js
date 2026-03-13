// socket.js
import { io } from "socket.io-client";

// Replace with your server URL
const SERVER_URL = "http://localhost:5000";  // Adjust this to match your server's URL

// Create a socket instance
export const socket = io(SERVER_URL, {
  // Options (optional)
  // autoConnect: false,  // Set to true (default) so the socket connects immediately
});

// Export additional socket events if needed
export const connectSocket = () => {
  socket.connect();
};

export const disconnectSocket = () => {
  socket.disconnect();
};

// Optionally handle socket events (like connection or disconnection events)
socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Socket disconnected");
});

// Handle any other events as needed
// socket.on("event-name", (data) => {
//   console.log(data);
// });
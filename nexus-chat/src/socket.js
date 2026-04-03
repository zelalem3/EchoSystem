// socket.js
import { io } from "socket.io-client";

// Replace with your server URL
const SERVER_URL = "http://localhost:5000 || https://echosystem-1.onrender.com"; 
// Create a socket instance
export const socket = io(SERVER_URL, {
  // Options (optional)
  // autoConnect: false,  
});


export const connectSocket = () => {
  socket.connect();
};

export const disconnectSocket = () => {
  socket.disconnect();
};


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
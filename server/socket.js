import { io } from "socket.io-client";


const SERVER_URL = "http://localhost:5000";  // Adjust this to match your server's URL


export const socket = io(SERVER_URL, {
  
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


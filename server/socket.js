import { io } from "socket.io-client";


const SERVER_URL = "http://localhost:5000";  


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


# 🚀 EchoSystem

A full-stack chat application that synchronizes messages in real-time across multiple clients using WebSockets, while persisting conversation history in a Google Firestore database.

## 🛠 Tech Stack

- **Frontend:** React (Vite), Firebase Auth (Web SDK)
- **Backend:** Node.js, Socket.io, Firebase Admin SDK
- **Database:** Google Cloud Firestore
- **Real-time:** Bi-directional Socket.io events

---

## 🏗 Firestore Structure

The project uses a **Subcollection** pattern. This keeps message data isolated within specific rooms for better performance and security.

- **Collection:** `rooms`
    - **Document:** `{roomId}` (e.g., "general-chat")
        - **Subcollection:** `messages`
            - **Document:** `{messageId}` (Auto-generated)
                - `email`: String (e.g., "user@example.com")
                - `message`: String (The chat text)
                - `timestamp`: String (ISO Format)

---

## ⚡ Key Features

- **Session Persistence:** Uses Firebase `onAuthStateChanged` to track user sessions across page refreshes.
- **Instant Messaging:** Broadcasts messages via Socket.io for immediate UI updates (low latency).
- **History Retrieval:** Automatically fetches and displays previous messages when a user joins a specific `roomId`.
- **Room Logic:** Users are grouped into rooms using `socket.join(roomId)`, ensuring private data streams for different chat topics.

---

## 🚀 Installation & Setup

### 1. Backend (Server)
1. Navigate to your server folder.
2. Place your `serviceAccountKey.json` (from Firebase Console) in the root.
3. Install dependencies:
   ```bash
   npm install express socket.io firebase-admin
   ```
   Start the server:

```Bash

node index.js
```
Gemini said
Here is the full content of the README.md in a single code block, formatted so you can copy and paste it directly into your project.

Markdown
# 🚀 Real-Time Firestore Chat Sync

A full-stack chat application that synchronizes messages in real-time across multiple clients using WebSockets, while persisting conversation history in a Google Firestore database.

## 🛠 Tech Stack

- **Frontend:** React (Vite), Firebase Auth (Web SDK)
- **Backend:** Node.js, Socket.io, Firebase Admin SDK
- **Database:** Google Cloud Firestore
- **Real-time:** Bi-directional Socket.io events

---

## 🏗 Firestore Structure

The project uses a **Subcollection** pattern. This keeps message data isolated within specific rooms for better performance and security.

- **Collection:** `rooms`
    - **Document:** `{roomId}` (e.g., "general-chat")
        - **Subcollection:** `messages`
            - **Document:** `{messageId}` (Auto-generated)
                - `email`: String (e.g., "user@example.com")
                - `message`: String (The chat text)
                - `timestamp`: String (ISO Format)

---

## ⚡ Key Features

- **Session Persistence:** Uses Firebase `onAuthStateChanged` to track user sessions across page refreshes.
- **Instant Messaging:** Broadcasts messages via Socket.io for immediate UI updates (low latency).
- **History Retrieval:** Automatically fetches and displays previous messages when a user joins a specific `roomId`.
- **Room Logic:** Users are grouped into rooms using `socket.join(roomId)`, ensuring private data streams for different chat topics.

---

## 🚀 Installation & Setup

### 1. Backend (Server)
1. Navigate to your server folder.
2. Place your `serviceAccountKey.json` (from Firebase Console) in the root.
3. Install dependencies:
   ```bash

   npm install express socket.io firebase-admin

   ```
Start the server:

```Bash

node index.js

```
2. Frontend (Client)
Ensure your firebase.js is configured with your Web SDK keys.

Install dependencies:

```Bash

npm install socket.io-client firebase

```
Start the Vite dev server:

```Bash

npm run dev

```
Gemini said
Here is the full content of the README.md in a single code block, formatted so you can copy and paste it directly into your project.

Markdown
# 🚀 Real-Time Firestore Chat Sync

A full-stack chat application that synchronizes messages in real-time across multiple clients using WebSockets, while persisting conversation history in a Google Firestore database.

## 🛠 Tech Stack

- **Frontend:** React (Vite), Firebase Auth (Web SDK)
- **Backend:** Node.js, Socket.io, Firebase Admin SDK
- **Database:** Google Cloud Firestore
- **Real-time:** Bi-directional Socket.io events

---

## 🏗 Firestore Structure

The project uses a **Subcollection** pattern. This keeps message data isolated within specific rooms for better performance and security.

- **Collection:** `rooms`
    - **Document:** `{roomId}` (e.g., "general-chat")
        - **Subcollection:** `messages`
            - **Document:** `{messageId}` (Auto-generated)
                - `email`: String (e.g., "user@example.com")
                - `message`: String (The chat text)
                - `timestamp`: String (ISO Format)

---

## ⚡ Key Features

- **Session Persistence:** Uses Firebase `onAuthStateChanged` to track user sessions across page refreshes.
- **Instant Messaging:** Broadcasts messages via Socket.io for immediate UI updates (low latency).
- **History Retrieval:** Automatically fetches and displays previous messages when a user joins a specific `roomId`.
- **Room Logic:** Users are grouped into rooms using `socket.join(roomId)`, ensuring private data streams for different chat topics.

---

## 🚀 Installation & Setup

### 1. Backend (Server)
1. Navigate to your server folder.
2. Place your `serviceAccountKey.json` (from Firebase Console) in the root.
3. Install dependencies:
   ```bash
   npm install express socket.io firebase-admin
Start the server:

Bash
node index.js
2. Frontend (Client)
Ensure your firebase.js is configured with your Web SDK keys.

Install dependencies:

Bash
npm install socket.io-client firebase
Start the Vite dev server:

Bash
npm run dev
📡 Socket Event API
Event Name	Direction	Payload	Description
joinRoom	Client ➔ Server	roomId	Moves user into a room and triggers history fetch.
chatHistory	Server ➔ Client	Array<Messages>	Sends existing Firestore messages to the new joiner.
sendMessage	Client ➔ Server	{ roomId, message, user }	Sends a new message to be saved and broadcasted.
receiveMessage	Server ➔ Client	{ email, message, timestamp }	Pushes a new message to everyone in the room.

Gemini said
Here is the full content of the README.md in a single code block, formatted so you can copy and paste it directly into your project.

Markdown
# 🚀 Real-Time Firestore Chat Sync

A full-stack chat application that synchronizes messages in real-time across multiple clients using WebSockets, while persisting conversation history in a Google Firestore database.

## 🛠 Tech Stack

- **Frontend:** React (Vite), Firebase Auth (Web SDK)
- **Backend:** Node.js, Socket.io, Firebase Admin SDK
- **Database:** Google Cloud Firestore
- **Real-time:** Bi-directional Socket.io events

---

## 🏗 Firestore Structure

The project uses a **Subcollection** pattern. This keeps message data isolated within specific rooms for better performance and security.

- **Collection:** `rooms`
    - **Document:** `{roomId}` (e.g., "general-chat")
        - **Subcollection:** `messages`
            - **Document:** `{messageId}` (Auto-generated)
                - `email`: String (e.g., "user@example.com")
                - `message`: String (The chat text)
                - `timestamp`: String (ISO Format)

---

## ⚡ Key Features

- **Session Persistence:** Uses Firebase `onAuthStateChanged` to track user sessions across page refreshes.
- **Instant Messaging:** Broadcasts messages via Socket.io for immediate UI updates (low latency).
- **History Retrieval:** Automatically fetches and displays previous messages when a user joins a specific `roomId`.
- **Room Logic:** Users are grouped into rooms using `socket.join(roomId)`, ensuring private data streams for different chat topics.

---

## 🚀 Installation & Setup

### 1. Backend (Server)
1. Navigate to your server folder.
2. Place your `serviceAccountKey.json` (from Firebase Console) in the root.
3. Install dependencies:
   ```bash
   npm install express socket.io firebase-admin
Start the server:

Bash
node index.js
2. Frontend (Client)
Ensure your firebase.js is configured with your Web SDK keys.

Install dependencies:

Bash
npm install socket.io-client firebase
Start the Vite dev server:

Bash
npm run dev
📡 Socket Event API
Event Name	Direction	Payload	Description
joinRoom	Client ➔ Server	roomId	Moves user into a room and triggers history fetch.
chatHistory	Server ➔ Client	Array<Messages>	Sends existing Firestore messages to the new joiner.
sendMessage	Client ➔ Server	{ roomId, message, user }	Sends a new message to be saved and broadcasted.
receiveMessage	Server ➔ Client	{ email, message, timestamp }	Pushes a new message to everyone in the room.
⚠️ Important Notes
CORS: The server is currently configured to accept connections from http://localhost:5173. Update this in the Server config if your port changes.

Cleaning Up: When a user switches rooms, the React useEffect hook automatically cleans up listeners and notifies the server to "leave" the room to prevent memory leaks.

Firestore Timestamps: The project currently uses ISOStrings. For high-precision sorting, consider migrating to admin.firestore.FieldValue.serverTimestamp().

Developed with React, Socket.io, and Firebase.


---

## 🛠 Project Status
**Current Version:** 1.0.0-alpha  
**Status:** In Development (Core Messaging Functional)

## 🤝 Contribution
1. Fork the repository.
2. Create a new feature branch.
3. Submit a Pull Request with a detailed description of changes.

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

---
Created with ❤️ by Zelalem


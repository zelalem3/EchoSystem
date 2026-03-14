# 🚀 EchoSystem

A full-stack real-time chat application with persistent room tracking, live presence indicators, and synchronized conversation history.

## 🛠 Tech Stack

- **Frontend:** React (Vite), Firebase Auth (Web SDK)
- **Backend:** Node.js, Socket.io, Firebase Admin SDK
- **Database:** Google Cloud Firestore
- **Real-time:** Bi-directional Socket.io events

---

## 🏗 Firestore Architecture

The project uses a **Relational Subcollection Pattern** to ensure users can return to their chats easily.

### Data Model:
- **`users`** (Collection)
    - **`{userEmail}`** (Document)
        - **`joined_rooms`** (Subcollection): Stores IDs of rooms the user has entered.
- **`rooms`** (Collection)
    - **`{roomId}`** (Document)
        - **`messages`** (Subcollection): Historical chat data.
        - **`members`** (Subcollection): List of users who have ever joined.


## ⚡ Advanced Features

- **Session Persistence:** Uses Firebase `onAuthStateChanged` to keep you logged in.
- **Persistent Room Lists:** Users see a sidebar of every room they've previously joined, fetched on login.
- **Real-Time Presence:** A dynamic "Online" counter shows how many people are currently active in the room.
- **Typing Indicators:** See when others are writing with the "user is typing..." status.
- **Auto-Scroll UI:** Message area automatically stays at the bottom for new incoming messages.
- **Responsive Bubbles:** Modern chat UI with right-aligned (sender) and left-aligned (receiver) message bubbles.



## 🚀 Installation & Setup

### 1. Backend (Server)
1. Navigate to the server folder.
2. Place your `serviceAccountKey.json` in the root.
3. Install dependencies:

```Bash
   npm install express socket.io firebase-admin
```

   
Start the server:

```Bash
node index.js
```

### 2. Frontend (Client)
Configure your firebase.js with your Web SDK keys.

Install dependencies:

```Bash
npm install socket.io-client firebase
```
Start the Vite dev server:

```Bash
npm run dev
```

## ⚠️ Developer Notes
Cleanup: The useEffect hooks in ChatEditor and Sidebar use socket.off() to prevent memory leaks and duplicate message listeners.

Security: Ensure your Firestore rules allow the Admin SDK to perform batch writes for the user-room linking logic.

Environment: The server defaults to port 5000. If you change this, update the socket.js connection string on the frontend.



## 🤝 Contribution
Fork the repository.

Create a new feature branch.

Submit a Pull Request.

## 📄 License
   This project is licensed under the MIT License.

Created with ❤️ by Zelalem

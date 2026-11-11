# 💬 EchoSystem

**Real-time messaging platform** with persistent rooms, live presence, typing indicators, and synchronized conversation history.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-echo--system--six.vercel.app-blue?style=for-the-badge)](https://echo-system-six.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 📖 Overview

EchoSystem is a full-stack real-time chat application focused on **instant communication, presence awareness, and reliable state synchronization** between clients and the server.

Users can create or join rooms, see who is online, watch typing indicators in real time, and return to their previous conversations through a carefully designed Firestore data model.

## ✨ Features

- 💬 **Real-time messaging** — Instant message delivery using Socket.IO.
- 🟢 **Live presence** — Displays the online user count for each room.
- ⌨️ **Typing indicators** — Shows when another user is typing.
- 🗂️ **Persistent room list** — Maintains a sidebar of rooms each user has joined.
- 🔐 **Session persistence** — Firebase Authentication with `onAuthStateChanged`.
- 📜 **Chat history** — Loads previous messages when users join a room.
- 🎨 **Modern chat UI** — Sender and receiver message bubbles with automatic scrolling.
- 🔄 **Event-driven architecture** — Keeps client and server state synchronized through real-time events.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router |
| Authentication | Firebase Authentication (Web SDK) |
| Real-time communication | Socket.IO (client and server) |
| Backend | Node.js, Express |
| Database | Google Cloud Firestore |
| Admin SDK | Firebase Admin SDK |
| Frontend deployment | Vercel |
| Backend deployment | Render |

---

## 🏗️ Architecture & Data Model

EchoSystem uses a Firestore subcollection structure to maintain relationships between users, rooms, and messages, allowing users to return to previously joined conversations.

### Firestore Structure

```text
users/
└── {userEmail}/
    └── joined_rooms/
        └── {roomId}/

rooms/
└── {roomId}/
    ├── messages/
    │   └── {messageId}/
    └── members/
        └── {memberId}/
```

### Key Flows

- **Joining a room:** When a user joins a room, the application records the membership in `rooms/{roomId}/members` and adds the room to `users/{userEmail}/joined_rooms`.
- **Authentication:** After login, the application retrieves the user's joined rooms and populates the sidebar.
- **Message delivery:** Messages are persisted in Firestore and broadcast to connected clients through Socket.IO.
- **Chat history:** When a user joins a room, the application loads previously stored messages.
- **Presence and typing:** Socket.IO events keep room presence and typing indicators synchronized in real time.

---

## 🚀 Getting Started

Follow these instructions to run EchoSystem locally.

### Prerequisites

Make sure you have the following installed or configured:

- [Docker Engine and Docker Compose](https://docs.docker.com/compose/install/) to run the containerized stack
- [Node.js 20.19+](https://nodejs.org/) and npm only if running the frontend or backend directly
- A [Firebase project](https://console.firebase.google.com/) with Firebase Authentication and Cloud Firestore enabled
- A Firebase service account key for the backend

### 1. Clone the Repository

```bash
git clone https://github.com/zelalem3/EchoSystem.git
cd EchoSystem
```

### Run the full stack with Docker Compose

Docker Compose starts the React frontend, Socket.IO backend, and Redis:

```bash
cp .env.example .env
```

Set `FIREBASE_SERVICE_ACCOUNT` in `.env` to your Firebase Admin service-account JSON as a single-line, single-quoted value. Keep the `.env` file private; it is ignored by Git. Then start the stack:

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). The backend is available at `http://localhost:10000`, and its health endpoint is `http://localhost:10000/health`. Redis is available to the backend on the private Compose network and persists its data in a named volume.

Stop the containers with `Ctrl+C`, or run `docker compose down`. To also remove persisted Redis data, run `docker compose down -v`.

The frontend URL and allowed backend origins can be changed through `VITE_SERVER_URL` and `CORS_ALLOWED_ORIGINS` in `.env`. Rebuild after changing `VITE_SERVER_URL`, because Vite embeds it into the static frontend bundle. For production, use a managed Redis instance with authentication/TLS and configure deployment secrets rather than using the local Compose Redis service.

### 2. Set Up the Backend

Navigate to the backend directory and install dependencies:

```bash
cd server
npm install
```

#### Configure Firebase Admin SDK

The backend needs Firebase Admin credentials to interact securely with Firestore.

You can configure the credentials using either of these approaches:

**Option A: Local development**

Place your Firebase service account key in the `server/` directory:

```text
server/
└── serviceAccountKey.json
```

Make sure this file is excluded from version control.

**Option B: Production**

Set the `FIREBASE_SERVICE_ACCOUNT` environment variable to the service account JSON string in your deployment environment.

Never commit service account credentials or expose them in frontend code.

#### Configure Redis for multiple backend instances

The backend uses Redis to share Socket.IO broadcasts and room-presence counts across server instances. Configure the same `REDIS_URL` on every instance:

```bash
REDIS_URL=redis://localhost:6379
```

In production, use the connection URL supplied by your managed Redis provider and store it as a deployment secret. When `REDIS_URL` is unset, the server runs in single-instance mode with local-only presence. Redis must be reachable before the server starts when the variable is configured.

The frontend currently prefers WebSocket and allows polling as a fallback. If the deployment falls back to HTTP long-polling, configure sticky sessions on the load balancer so all requests for a Socket.IO connection reach the same backend instance.

#### Start the Backend

```bash
npm start
```

The backend uses the port configured through `PORT`, defaulting to `10000` when no port is specified.

### 3. Set Up the Frontend

Open another terminal and navigate to the frontend directory:

```bash
cd frontend
npm install
```

#### Configure Firebase

Open `src/firebase.js` and configure your Firebase Web SDK settings:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // Add the remaining Firebase configuration values.
};
```

Use the configuration from your Firebase project. Do not put Firebase Admin credentials in the frontend.

#### Configure the Socket.IO Connection

Set the backend URL through Vite's `VITE_SERVER_URL` environment variable:

```env
VITE_SERVER_URL=http://localhost:10000
```

For local development, use your local backend URL. For production, configure the deployed backend URL before building.

#### Start the Frontend

```bash
npm run dev
```

The application will be available at:

[http://localhost:5173](http://localhost:5173)

---

## 📁 Project Structure

```text
EchoSystem/
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── AuthComponent.jsx
│   │   ├── ChatEditor.jsx
│   │   ├── sidebar.jsx
│   │   ├── ConnectionManager.jsx
│   │   ├── firebase.js
│   │   ├── socket.js
│   │   └── ...
│   ├── Dockerfile
│   └── package.json
│
├── server/                     # Node.js + Socket.IO backend
│   ├── src/
│   │   ├── config/             # Firebase and runtime configuration
│   │   ├── services/           # Message history and presence services
│   │   ├── socket/             # Socket.IO event handlers
│   │   ├── app.js              # HTTP and Socket.IO application setup
│   │   └── index.js            # Process entry point and Redis startup
│   ├── Dockerfile
│   ├── package.json
│   └── serviceAccountKey.json  # Local credentials (gitignored)
│
├── docker-compose.yml          # Frontend, backend, and Redis services
└── README.md
```

---

## ⚠️ Important Notes

### Socket Listener Cleanup

React components such as `ChatEditor` and `sidebar` should clean up Socket.IO event listeners in their `useEffect` cleanup functions. Using `socket.off()` with the appropriate event name and handler helps prevent duplicate listeners and memory leaks.

### Firestore Security

Configure Firestore Security Rules to protect user and room data. The Firebase Admin SDK operates with privileged server-side credentials and bypasses Firestore Security Rules, so backend authorization and validation must be implemented appropriately.

Socket.IO connections must authenticate with a Firebase ID token. The server uses the authenticated account for room membership and message identity; client-supplied identity fields are ignored. A user can create a room by claiming an unused room name, while existing rooms are restricted to their recorded members. Messages are limited to 2,000 characters, with per-connection limits on message, room-join, and typing events.

### CORS Configuration

The backend must allow requests and Socket.IO connections from the frontend origin.

For local development, configure:

```text
http://localhost:5173
```

For production, configure your deployed Vercel frontend origin:

```text
https://echo-system-six.vercel.app
```

Allow only the origins required by your deployment.

### Backend Port

The backend uses `process.env.PORT` when available and defaults to port `10000`. Ensure the frontend's Socket.IO URL matches the environment where the backend is running.

### Environment Variables and Secrets

- Keep Firebase service account credentials private.
- Never commit `.env` files or service account JSON files containing secrets.
- Configure production environment variables through your hosting provider.
- Use `.gitignore` to exclude sensitive files.

---

## 🌐 Live Demo

Try EchoSystem here:

**[Open EchoSystem](https://echo-system-six.vercel.app)**

- **Frontend:** Vercel
- **Backend:** Node.js, Express, and Socket.IO hosted on Render

*Note: The live application depends on the availability and configuration of the deployed backend and Firebase services.*

---

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome!

To contribute:

1. Fork the repository.
2. Clone your fork.
3. Create a feature branch:

   ```bash
   git checkout -b feature/amazing-feature
   ```

4. Make your changes and test them.
5. Commit your changes:

   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

6. Push your branch:

   ```bash
   git push origin feature/amazing-feature
   ```

7. Open a pull request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Zelalem Getnet**

Full-Stack Software Engineer · Computer Science Graduate · ALX Software Engineering Alumni

- **GitHub:** [zelalem3](https://github.com/zelalem3)
- **LinkedIn:** [Zelalem Getnet](https://linkedin.com/in/zelalem-getnet-533326246)

---

**Built with ❤️ by Zelalem**

import React, { useState, useEffect } from "react";
import { socket } from "./socket";
import { ConnectionState } from "./ConnectionState";
import { ChatEditor } from "./ChatEditor";
import AuthComponent from "./AuthComponent";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Sidebar } from "./sidebar";
import { auth } from "./firebase";
import { MyForm } from "./MyForm";
import { Button, Spinner, EmptyState } from "./components/ui";

export default function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentRoomId, setCurrentRoomId] = useState("");
  const [savedRooms, setSavedRooms] = useState([]);

  useEffect(() => {
    if (user) {
      socket.emit("getUserRooms", user.email);
      socket.on("userRoomsList", (rooms) => setSavedRooms(rooms));
    }

    return () => socket.off("userRoomsList");
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            Loading EchoSystem...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthComponent />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-bg)] font-sans">
      {/* LEFT SIDEBAR */}
      <Sidebar
        savedRooms={savedRooms}
        currentRoomId={currentRoomId}
        setCurrentRoomId={setCurrentRoomId}
      />

      {/* MAIN AREA */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* HEADER */}
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text)]">
              EchoSystem
            </h1>
            <ConnectionState isConnected={isConnected} />
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-[var(--color-text-secondary)] sm:inline">
              {user.email}
            </span>
            <Button variant="secondary" size="sm" onClick={() => signOut(auth)}>
              Logout
            </Button>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex flex-1 gap-5 overflow-hidden p-5">
          {/* ROOM FORM PANEL */}
          <div className="hidden w-[280px] shrink-0 md:block">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
              <MyForm setDocumentId={setCurrentRoomId} />
            </div>
          </div>

          {/* CHAT PANEL */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            {currentRoomId ? (
              <ChatEditor documentId={currentRoomId} />
            ) : (
              <EmptyState
                icon="💬"
                title="No room selected"
                description="Select a channel from the sidebar or create a new room to start chatting."
                className="h-full"
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
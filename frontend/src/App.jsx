import React, { useState, useEffect } from "react";
import { socket } from "./socket";
import { ConnectionState } from "./ConnectionState";
import { ChatEditor } from "./ChatEditor";
import AuthComponent from "./AuthComponent";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Sidebar } from "./sidebar";
import { auth } from "./firebase";
import { Button, Spinner, EmptyState } from "./components/ui";

export default function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentRoomId, setCurrentRoomId] = useState("");
  const [savedRooms, setSavedRooms] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
      {/* SIDEBAR */}
      <Sidebar
        savedRooms={savedRooms}
        currentRoomId={currentRoomId}
        setCurrentRoomId={setCurrentRoomId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* MAIN AREA */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* TOP HEADER */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile) */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] md:hidden"
              aria-label="Open sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-base font-bold tracking-tight text-[var(--color-text)] sm:text-lg">
              EchoSystem
            </h1>
            <ConnectionState isConnected={isConnected} />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden truncate text-sm text-[var(--color-text-secondary)] sm:inline max-w-[180px]">
              {user.email}
            </span>
            <Button variant="secondary" size="sm" onClick={() => signOut(auth)}>
              Logout
            </Button>
          </div>
        </header>

        {/* CHAT AREA — full width */}
        <main className="flex flex-1 overflow-hidden p-0 md:p-4">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-surface)] md:rounded-[var(--radius-lg)] md:border md:border-[var(--color-border)] md:shadow-sm">
            {currentRoomId ? (
              <ChatEditor documentId={currentRoomId} />
            ) : (
              <EmptyState
                icon="💬"
                title="No room selected"
                description="Open the sidebar and create or join a channel to start chatting."
                className="h-full"
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    className="md:hidden"
                    onClick={() => setSidebarOpen(true)}
                  >
                    Open channels
                  </Button>
                }
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
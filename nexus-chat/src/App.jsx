import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import { ConnectionState } from './ConnectionState';
import { ChatEditor } from './ChatEditor';
import AuthComponent from './AuthComponent';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Sidebar } from './sidebar';
import { auth } from './firebase';
import { MyForm } from './MyForm';

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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };

  }, []);

  if (loading) return <div style={loaderStyle}>Loading EchoSystem...</div>;

  if (!user) {
    return <AuthComponent onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div style={appLayout}>

      {/* LEFT SIDEBAR */}
      <Sidebar
        savedRooms={savedRooms}
        currentRoomId={currentRoomId}
        setCurrentRoomId={setCurrentRoomId}
      />

      {/* MAIN AREA */}
      <div style={mainContainer}>

        {/* HEADER */}
        <header style={headerStyle}>

          <div style={headerInfo}>
            <h1 style={logoStyle}>🚀 EchoSystem</h1>
            <ConnectionState isConnected={isConnected} />
          </div>

          <div style={userActions}>
            <span style={userEmail}>{user.email}</span>
            <button onClick={() => signOut(auth)} style={logoutBtn}>
              Logout
            </button>
          </div>

        </header>

        {/* CONTENT */}
        <main style={contentGrid}>

          {/* ROOM FORM PANEL */}
          <div style={sidePanel}>
            <MyForm setDocumentId={setCurrentRoomId} />
          </div>

          {/* CHAT PANEL */}
          <div style={chatPanel}>

            {currentRoomId ? (
              <ChatEditor documentId={currentRoomId} />
            ) : (
              <div style={emptyChat}>
                Select or create a room to start chatting
              </div>
            )}

          </div>

        </main>

      </div>
    </div>
  );
}






/* ------------------- STYLES ------------------- */

const appLayout = {
  display: 'flex',
  height: '150vh',
  width: '100%',
  backgroundColor: '#f3f4f6',
  overflow: 'hidden',
  fontFamily: '"Inter", sans-serif'
};


const mainContainer = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};


const headerStyle = {
  height: '70px',
  backgroundColor: '#fff',
  borderBottom: '1px solid #e5e7eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 30px',
  flexShrink: 0
};


const logoStyle = {
  fontSize: '1.25rem',
  fontWeight: '900',
  margin: 0,
  color: '#111827',
  letterSpacing: '-0.05em'
};


const headerInfo = {
  display: 'flex',
  alignItems: 'center',
  gap: '15px'
};


const userActions = {
  display: 'flex',
  alignItems: 'center',
  gap: '20px'
};


const userEmail = {
  fontSize: '0.85rem',
  color: '#6b7280',
  fontWeight: '500'
};


const logoutBtn = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: '600'
};


const contentGrid = {
  flex: 1,
  padding: '24px',
  display: 'flex',
  gap: '24px',
  overflow: 'hidden'
};


const sidePanel = {
  width: '280px',
  minWidth: '260px',
  background: '#fff',
  borderRadius: '10px',
  padding: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  height: 'fit-content'
};


const chatPanel = {
  flex: 1,
  background: '#fff',
  borderRadius: '10px',
  padding: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};


const emptyChat = {
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: '#9ca3af',
  fontSize: '0.9rem'
};


const loaderStyle = {
  display: 'flex',
  height: '100vh',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '1.2rem',
  fontWeight: '600',
  color: '#3b82f6'
};
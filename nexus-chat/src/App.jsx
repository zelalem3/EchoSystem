import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import { ConnectionState } from './ConnectionState';
import { ConnectionManager } from './ConnectionManager';
// Import the fixed ChatEditor from our previous step
import { ChatEditor } from './ChatEditor'; 

import AuthComponent from './AuthComponent';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase'; 

export default function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [user, setUser] = useState(null); 
  const [loading, setLoading] = useState(true);

  // For testing, let's hardcode a roomId. 
  // In a real app, you might get this from a URL or a list of rooms.
  const [currentRoomId, setCurrentRoomId] = useState("general-chat");

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

  if (loading) return <div>Loading session...</div>;

  if (!user) {
    return <AuthComponent onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="App" style={{ padding: '20px' }}>
      <header style={{ borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
        <h1>My Chat App</h1>
        <p>Logged in as: <strong>{user.email}</strong></p>
        <ConnectionState isConnected={isConnected} />
      </header>

      <main style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <ConnectionManager />
          
          {/* THE CHAT COMPONENT */}
          <ChatEditor documentId={currentRoomId} />
        </div>

        <aside style={{ width: '200px' }}>
           <h3>Rooms</h3>
           <button onClick={() => setCurrentRoomId("general-chat")}>General</button>
           <button onClick={() => setCurrentRoomId("dev-team")}>Dev Team</button>
        </aside>
      </main>
    </div>
  );
}
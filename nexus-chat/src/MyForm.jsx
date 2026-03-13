import React, { useState } from 'react';

export function MyForm({ setDocumentId }) {
  const [roomIdInput, setRoomIdInput] = useState('');

  const handleJoin = (event) => {
    event.preventDefault();
    const cleanId = roomIdInput.trim().toLowerCase(); // Clean up IDs for consistency
    if (!cleanId) return;

    // We only set the ID here. 
    // The ChatEditor component handles the socket.emit('joinRoom') in its useEffect.
    setDocumentId(cleanId);
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={iconStyle}>💬</div>
        <h2 style={titleStyle}>Join a Chat Room</h2>
        <p style={subtitleStyle}>
          Enter a Room Name to connect with your team. If the room doesn't exist, it will be created.
        </p>
        
        <form onSubmit={handleJoin} style={formStyle}>
          <input 
            type="text"
            placeholder="e.g. general-chat"
            style={inputStyle}
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
          />
          <button type="submit" style={buttonStyle}>
            Enter Room
          </button>
        </form>
      </div>
    </div>
  );
}

// Inline Styles for a Modern Look
const containerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '60vh',
  padding: '20px'
};

const cardStyle = {
  backgroundColor: '#ffffff',
  padding: '40px',
  borderRadius: '16px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
  maxWidth: '400px',
  width: '100%',
  textAlign: 'center',
  border: '1px solid #f3f4f6'
};

const iconStyle = {
  fontSize: '3.5rem',
  marginBottom: '16px'
};

const titleStyle = {
  fontSize: '1.75rem',
  fontWeight: '800',
  color: '#111827',
  marginBottom: '8px',
  letterSpacing: '-0.025em'
};

const subtitleStyle = {
  color: '#6b7280',
  marginBottom: '32px',
  lineHeight: '1.5',
  fontSize: '0.95rem'
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px'
};

const inputStyle = {
  padding: '14px',
  borderRadius: '8px',
  border: '1.5px solid #e5e7eb',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border-color 0.2s',
  textAlign: 'center'
};

const buttonStyle = {
  backgroundColor: '#2563eb',
  color: 'white',
  padding: '14px',
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '1rem',
  transition: 'background-color 0.2s',
};
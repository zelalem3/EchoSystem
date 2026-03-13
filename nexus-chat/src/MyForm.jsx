// MyForm.js
import React, { useState } from 'react';
import { socket } from './socket';

export function MyForm({ setDocumentId }) {
  const [documentIdInput, setDocumentIdInput] = useState('');

  const handleChange = (event) => {
    setDocumentIdInput(event.target.value);
  };

// Inside MyForm.js handleJoin
const handleJoin = (event) => {
  event.preventDefault();
  if (!documentIdInput) return;

  setDocumentId(documentIdInput);
  socket.emit('joinRoom', documentIdInput);
  
  // OPTIONAL: Manually add a log for the local user
  // (You would need to pass fooEvents setter to MyForm as a prop to do this)
};

 return (
    <div style={{ textAlign: 'center', marginTop: '100px', maxWidth: '400px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '20px' }}>✍️</div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Collaborative Editor</h2>
      <p style={{ color: '#6b7280', marginBottom: '30px' }}>
        Enter a Document ID to start working with your team in real-time.
      </p>
      
      <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text"
          placeholder="e.g. biology-project"
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            outlineColor: '#3b82f6'
          }}
          value={documentIdInput}
          onChange={(e) => setDocumentIdInput(e.target.value)}
        />
        <button 
          type="submit"
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Join
        </button>
      </form>
    </div>
  );
}
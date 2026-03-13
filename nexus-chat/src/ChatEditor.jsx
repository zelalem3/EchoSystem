import React, { useEffect, useState } from 'react';
import { socket } from './socket';
import { auth } from './firebase';

export function ChatEditor({ documentId }) {
    const [messages, setMessages] = useState([]); // Store array of messages
    const [input, setInput] = useState('');      // Store current typing string

    useEffect(() => {
        if (!documentId) return;

        // 1. Join the room
        socket.emit('joinRoom', documentId);

        // 2. Listen for existing history
        socket.on('chatHistory', (history) => {
            setMessages(history);
        });

        // 3. Listen for new incoming messages
        socket.on('receiveMessage', (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        });

        return () => {
            socket.emit('leaveRoom', documentId);
            socket.off('chatHistory');
            socket.off('receiveMessage');
        };
    }, [documentId]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const payload = {
            roomId: documentId,
            message: input,
            user: { email: auth.currentUser.email }
        };

        socket.emit('sendMessage', payload);
        setInput(''); // Clear input
    };

    return (
        <div style={{ padding: '20px', maxWidth: '500px' }}>
            <h2>Chat: {documentId}</h2>
            
            {/* Message Display Area */}
            <div style={{ height: '300px', border: '1px solid #ccc', overflowY: 'scroll', marginBottom: '10px', padding: '10px' }}>
                {messages.map((msg, index) => (
                    <div key={index} style={{ marginBottom: '10px' }}>
                        <strong>{msg.email.split('@')[0]}: </strong>
                        <span>{msg.message}</span>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    style={{ width: '80%', padding: '10px' }}
                />
                <button type="submit" style={{ width: '18%', padding: '10px' }}>Send</button>
            </form>
        </div>
    );
}
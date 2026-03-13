import React, { useEffect, useState, useRef } from 'react';
import { socket } from './socket';
import { auth } from './firebase';

export function ChatEditor({ documentId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [activeUsers, setActiveUsers] = useState(0); 
    const scrollRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (!documentId) return;

        // 1. Join Room
        socket.emit('joinRoom', documentId);

        // 2. Listen for dynamic user count from server
        socket.on('userCountUpdate', (count) => {
            setActiveUsers(count);
        });

        // 3. Listen for History
        socket.on('chatHistory', (history) => {
            setMessages(history);
        });

        // 4. Listen for New Messages
        socket.on('receiveMessage', (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        });

        // Cleanup on unmount or room change
        return () => {
            socket.emit('leaveRoom', documentId);
            socket.off('userCountUpdate');
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
        setInput('');
    };

    return (
        <div style={containerStyle}>
            {/* Dynamic Header */}
            <div style={headerStyle}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}># {documentId}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                        <span style={{ 
                            ...dotStyle, 
                            backgroundColor: activeUsers > 1 ? '#10b981' : '#9ca3af' 
                        }}></span>
                        <span style={statusTextStyle}>
                            {activeUsers > 1 ? `${activeUsers} people online` : 'Only you are here'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Chat Messages */}
            <div style={messageAreaStyle} ref={scrollRef}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '20px', fontSize: '0.9rem' }}>
                        No messages yet. Start the conversation!
                    </div>
                )}
                {messages.map((msg, index) => {
                    const isMe = msg.email === auth.currentUser?.email;
                    return (
                        <div key={index} style={{ 
                            ...messageRowStyle, 
                            justifyContent: isMe ? 'flex-end' : 'flex-start' 
                        }}>
                            <div style={{ 
                                ...bubbleStyle, 
                                backgroundColor: isMe ? '#2563eb' : '#fff',
                                color: isMe ? 'white' : '#1f2937',
                                border: isMe ? 'none' : '1px solid #e5e7eb',
                                borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px'
                            }}>
                                {!isMe && <div style={senderStyle}>{msg.email.split('@')[0]}</div>}
                                <div style={{ wordBreak: 'break-word' }}>{msg.message}</div>
                                <div style={{ 
                                    ...timeStyle, 
                                    color: isMe ? '#bfdbfe' : '#9ca3af' 
                                }}>
                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                </div>

                            </div>
                        </div>
                    );
                })}

            </div>

            <div>
                <button onClick={() => socket.emit('leaveRoom', documentId)} style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    margin: '10px'
                }}>
                    Leave Room
                </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} style={inputWrapperStyle}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Write a message..."
                    style={inputStyle}
                />
                <button type="submit" style={sendButtonStyle} disabled={!input.trim()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </form>
        </div>
    );
}

// --- STYLES ---

const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '85vh',
    width: '95%',
    maxWidth: '600px',
    margin: '10px auto',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    border: '1px solid #e5e7eb'
};

const headerStyle = {
    padding: '16px 24px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10
};

const dotStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block'
};

const statusTextStyle = {
    fontSize: '0.8rem',
    color: '#6b7280',
    fontWeight: '500'
};

const messageAreaStyle = {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
};

const messageRowStyle = {
    display: 'flex',
    width: '100%'
};

const bubbleStyle = {
    maxWidth: '80%',
    padding: '12px 16px',
    fontSize: '0.95rem',
    position: 'relative',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const senderStyle = {
    fontSize: '0.75rem',
    fontWeight: '700',
    marginBottom: '4px',
    color: '#3b82f6',
    textTransform: 'capitalize'
};

const timeStyle = {
    fontSize: '0.65rem',
    marginTop: '6px',
    textAlign: 'right',
    fontWeight: '500'
};

const inputWrapperStyle = {
    padding: '16px 20px',
    display: 'flex',
    gap: '12px',
    backgroundColor: '#fff',
    borderTop: '1px solid #f3f4f6'
};

const inputStyle = {
    flex: 1,
    padding: '12px 18px',
    borderRadius: '24px',
    border: '1.5px solid #f3f4f6',
    outline: 'none',
    fontSize: '0.95rem',
    backgroundColor: '#f9fafb',
    transition: 'all 0.2s ease'
};

const sendButtonStyle = {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '46px',
    height: '46px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)'
};
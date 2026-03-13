import React, { useEffect, useState, useRef } from 'react';
import { socket } from './socket';
import { auth } from './firebase';

export function ChatEditor({ documentId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [activeUsers, setActiveUsers] = useState(0);
    const [typingUser, setTypingUser] = useState(null);
    const scrollRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        if (!documentId || !auth.currentUser) return;

        // Join room with User Object for persistence
        socket.emit('joinRoom', { roomId: documentId, user: { email: auth.currentUser.email } });

        socket.on('userCountUpdate', (count) => setActiveUsers(count));
        socket.on('userTypingUpdate', ({ email, isTyping }) => {
            setTypingUser(isTyping ? email.split('@')[0] : null);
        });
        socket.on('chatHistory', (history) => setMessages(history));
        socket.on('receiveMessage', (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
            setTypingUser(null);
        });

        return () => {
            socket.emit('leaveRoom', documentId);
            socket.off('userCountUpdate');
            socket.off('userTypingUpdate');
            socket.off('chatHistory');
            socket.off('receiveMessage');
        };
    }, [documentId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, typingUser]);

    const handleInputChange = (e) => {
        setInput(e.target.value);
        socket.emit('typing', { roomId: documentId, user: { email: auth.currentUser.email }, isTyping: true });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('typing', { roomId: documentId, user: { email: auth.currentUser.email }, isTyping: false });
        }, 2000);
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        socket.emit('sendMessage', { roomId: documentId, message: input, user: { email: auth.currentUser.email } });
        setInput('');
    };

    return (
        <div style={containerStyle}>
            <div style={headerStyle}>
                <div>
                    <h3 style={{ margin: 0 }}># {documentId}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{...dotStyle, backgroundColor: activeUsers > 1 ? '#10b981' : '#9ca3af'}}></span>
                        <span style={statusTextStyle}>
                            {activeUsers > 1 ? `${activeUsers} online` : 'Only you'}
                        </span>
                    </div>
                </div>
            </div>

            <div style={messageAreaStyle} ref={scrollRef}>
                {messages.map((msg, i) => {
                    const isMe = msg.email === auth.currentUser?.email;
                    return (
                        <div key={i} style={{ ...messageRowStyle, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{ 
                                ...bubbleStyle, 
                                backgroundColor: isMe ? '#2563eb' : '#fff', 
                                color: isMe ? '#fff' : '#1f2937',
                                border: isMe ? 'none' : '1px solid #e5e7eb',
                                borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px'
                            }}>
                                {!isMe && <small style={senderStyle}>{msg.email.split('@')[0]}</small>}
                                <div style={{ wordBreak: 'break-word' }}>{msg.message}</div>
                                <div style={{ 
                                    ...timeStyle, 
                                    color: isMe ? '#bfdbfe' : '#9ca3af' 
                                }}>
                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {typingUser && (
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic', marginLeft: '10px' }}>
                        {typingUser} is typing...
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} style={inputWrapperStyle}>
                <input 
                    style={inputStyle} 
                    value={input} 
                    onChange={handleInputChange} 
                    placeholder="Type message..." 
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

// --- STYLES (Fixed Naming) ---

const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',        // fill parent instead of fixed screen
    width: '100%',         // take full width
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
    maxWidth: '70%',
    padding: '12px 16px',
    fontSize: '0.95rem',
    position: 'relative',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const senderStyle = {
    display: 'block',
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
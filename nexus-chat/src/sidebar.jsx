import React from 'react';

export function Sidebar({ savedRooms, currentRoomId, setCurrentRoomId }) {
    return (
        <aside style={sidebarContainer}>
            <div style={sidebarHeader}>
                <h2 style={sidebarTitle}>Channels</h2>
                <span style={badgeStyle}>{savedRooms.length}</span>
            </div>

            <div style={roomListStyle}>
                {savedRooms.length === 0 ? (
                    <p style={emptyTextStyle}>No joined rooms yet.</p>
                ) : (
                    savedRooms.map((id) => {
                        const isActive = currentRoomId === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setCurrentRoomId(id)}
                                style={{
                                    ...roomButtonStyle,
                                    backgroundColor: isActive ? '#eff6ff' : 'transparent',
                                    color: isActive ? '#2563eb' : '#4b5563',
                                    fontWeight: isActive ? '700' : '500',
                                    borderLeft: isActive ? '4px solid #2563eb' : '4px solid transparent',
                                }}
                            >
                                <span style={{ opacity: 0.5, marginRight: '8px' }}>#</span>
                                {id}
                            </button>
                        );
                    })
                )}
            </div>
        </aside>
    );
}

// --- SIDEBAR STYLES ---

const sidebarContainer = {
    width: '260px',
    height: '85vh',
    backgroundColor: '#fff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    margin: '10px 0 10px 10px', // Matches your ChatEditor margin
    borderRadius: '16px 0 0 16px', // Rounded corners on the left side
    boxShadow: '-10px 10px 40px rgba(0,0,0,0.04)',
};

const sidebarHeader = {
    padding: '24px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
};

const sidebarTitle = {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#111827',
    margin: 0,
    letterSpacing: '-0.02em',
};

const badgeStyle = {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
};

const roomListStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '0 10px',
};

const roomButtonStyle = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    margin: '4px 0',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '0.95rem',
    transition: 'all 0.2s ease',
    outline: 'none',
};

const emptyTextStyle = {
    padding: '20px',
    fontSize: '0.85rem',
    color: '#9ca3af',
    textAlign: 'center',
};
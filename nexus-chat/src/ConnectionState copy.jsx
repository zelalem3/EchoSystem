// ConnectionState.js
import React from 'react';

export function ConnectionState({ isConnected }) {
  return (
    <div>
      {isConnected ? "Connected" : "Disconnected"}
    </div>
  );
}
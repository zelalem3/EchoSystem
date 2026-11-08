import React, { useState } from "react";
import { Button, Input } from "./components/ui";

export function MyForm({ setDocumentId }) {
  const [roomIdInput, setRoomIdInput] = useState("");

  const handleJoin = (event) => {
    event.preventDefault();
    const cleanId = roomIdInput.trim().toLowerCase();
    if (!cleanId) return;
    setDocumentId(cleanId);
    setRoomIdInput("");
  };

  return (
    <div className="flex flex-col">
      <div className="mb-1 text-2xl">💬</div>
      <h2 className="mb-1 text-lg font-bold tracking-tight text-[var(--color-text)]">
        Join a Room
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        Enter a room name to connect. If it doesn’t exist, it will be created.
      </p>

      <form onSubmit={handleJoin} className="flex flex-col gap-3">
        <Input
          placeholder="e.g. general"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
          autoComplete="off"
        />
        <Button type="submit" className="w-full" disabled={!roomIdInput.trim()}>
          Enter Room
        </Button>
      </form>
    </div>
  );
}
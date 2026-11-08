import React, { useState } from "react";
import { Badge, Button, Input } from "./components/ui";

export function Sidebar({
  savedRooms,
  currentRoomId,
  setCurrentRoomId,
  isOpen,
  onClose,
}) {
  const [roomInput, setRoomInput] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleJoin = (e) => {
    e.preventDefault();
    const cleanId = roomInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!cleanId) return;
    setCurrentRoomId(cleanId);
    setRoomInput("");
    setShowForm(false);
    onClose?.(); // close mobile drawer after joining
  };

  const handleSelectRoom = (id) => {
    setCurrentRoomId(id);
    onClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col
          border-r border-[var(--color-border)] bg-[var(--color-surface)]
          transition-transform duration-200 ease-out
          md:static md:z-auto md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚀</span>
            <h2 className="text-sm font-bold tracking-tight text-[var(--color-text)]">
              EchoSystem
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{savedRooms.length}</Badge>
            {/* Close button (mobile only) */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] md:hidden"
              aria-label="Close sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Channels label + New button */}
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Channels
          </span>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
          >
            {showForm ? "Cancel" : "+ New"}
          </button>
        </div>

        {/* Inline create/join form */}
        {showForm && (
          <form onSubmit={handleJoin} className="space-y-2 px-3 pb-3">
            <Input
              placeholder="room-name"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              autoComplete="off"
              autoFocus
              className="text-sm"
            />
            <Button
              type="submit"
              size="sm"
              className="w-full"
              disabled={!roomInput.trim()}
            >
              Join / Create
            </Button>
          </form>
        )}

        {/* Room list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {savedRooms.length === 0 && !showForm ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">
              No channels yet.
              <br />
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-2 text-[var(--color-primary)] hover:underline"
              >
                Create your first room
              </button>
            </p>
          ) : (
            <ul className="space-y-0.5">
              {savedRooms.map((id) => {
                const isActive = currentRoomId === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => handleSelectRoom(id)}
                      className={`
                        flex w-full items-center gap-2 rounded-[var(--radius-md)]
                        px-3 py-2 text-left text-sm transition-colors duration-150
                        ${
                          isActive
                            ? "bg-[var(--color-primary-light)] font-semibold text-[var(--color-primary)]"
                            : "font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]"
                        }
                      `}
                    >
                      <span className="opacity-50">#</span>
                      <span className="truncate">{id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            Rooms are created on first join
          </p>
        </div>
      </aside>
    </>
  );
}
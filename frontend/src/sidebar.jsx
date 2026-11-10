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
          fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[var(--color-border)]
          bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(248,250,255,0.88))]
          shadow-[var(--shadow-md)] transition-transform duration-200 ease-out
          md:static md:z-auto md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 text-lg shadow-lg shadow-violet-500/25">
              E
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[var(--color-text)]">
                EchoSystem
              </h2>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{savedRooms.length}</Badge>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] md:hidden"
              aria-label="Close sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Channels
          </span>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-[var(--color-primary-light)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-violet-100"
          >
            {showForm ? "Cancel" : "+ New"}
          </button>
        </div>

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

        <div className="flex-1 overflow-y-auto px-2 pb-4 pt-1">
          {savedRooms.length === 0 && !showForm ? (
            <div className="mt-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[rgba(255,255,255,0.35)] p-4 text-center text-sm text-[var(--color-text-muted)]">
              <p className="font-medium text-[var(--color-text-secondary)]">No channels yet</p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-2 font-semibold text-[var(--color-primary)] hover:underline"
              >
                Create your first room
              </button>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {savedRooms.map((id) => {
                const isActive = currentRoomId === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => handleSelectRoom(id)}
                      className={`
                        flex w-full items-center gap-2 rounded-[var(--radius-md)]
                        px-3 py-2.5 text-left text-sm transition-all duration-150
                        ${
                          isActive
                            ? "bg-gradient-to-r from-violet-50 via-indigo-50 to-blue-50 font-semibold text-violet-700 ring-1 ring-violet-200"
                            : "font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]"
                        }
                      `}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/60 text-xs font-bold text-[var(--color-text-muted)]">
                        #
                      </span>
                      <span className="truncate">{id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.22)] px-4 py-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            Rooms are created on first join
          </p>
        </div>
      </aside>
    </>
  );
}
import React from "react";
import { Badge } from "./components/ui";

export function Sidebar({ savedRooms, currentRoomId, setCurrentRoomId }) {
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Channels
        </h2>
        <Badge>{savedRooms.length}</Badge>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {savedRooms.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
            No joined rooms yet
          </p>
        ) : (
          <ul className="space-y-0.5">
            {savedRooms.map((id) => {
              const isActive = currentRoomId === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => setCurrentRoomId(id)}
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
    </aside>
  );
}
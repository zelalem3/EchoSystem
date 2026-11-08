import React from "react";

export function EmptyState({
  icon = "💬",
  title = "Nothing here yet",
  description,
  action,
  className = "",
}) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        px-6 py-12 text-center
        ${className}
      `}
    >
      <div className="mb-4 text-4xl opacity-80">{icon}</div>
      <h3 className="mb-1 text-base font-semibold text-[var(--color-text)]">
        {title}
      </h3>
      {description && (
        <p className="mb-5 max-w-xs text-sm text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
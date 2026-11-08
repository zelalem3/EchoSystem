import React from "react";

export function Input({
  label,
  error,
  className = "",
  id,
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-[var(--color-text)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full rounded-[var(--radius-md)] border border-[var(--color-border)]
          bg-[var(--color-surface)] px-3.5 py-2.5 text-[var(--color-text)]
          placeholder:text-[var(--color-text-muted)]
          transition-all duration-150
          focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20
          disabled:cursor-not-allowed disabled:opacity-60
          ${error ? "border-[var(--color-danger)] focus:ring-red-500/20" : ""}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
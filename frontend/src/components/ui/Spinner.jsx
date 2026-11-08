import React from "react";

export function Spinner({ size = "md", className = "" }) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[3px]",
  };

  return (
    <div
      className={`
        animate-spin rounded-full
        border-[var(--color-border)] border-t-[var(--color-primary)]
        ${sizes[size] || sizes.md}
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  );
}
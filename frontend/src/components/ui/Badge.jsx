import React from "react";

const variants = {
  default: "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
  primary: "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  danger: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function Badge({ children, variant = "default", className = "" }) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2 py-0.5
        text-xs font-medium
        ${variants[variant] || variants.default}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
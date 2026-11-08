import React from "react";

function getInitials(name = "") {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

const colors = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function Avatar({ name = "", size = "md", className = "" }) {
  const initials = getInitials(name) || "?";
  const color = colors[hashString(name) % colors.length];

  const sizes = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
  };

  return (
    <div
      className={`
        inline-flex shrink-0 items-center justify-center
        rounded-full font-semibold text-white
        ${color}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      title={name}
    >
      {initials}
    </div>
  );
}
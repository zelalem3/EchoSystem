import React from "react";
import { Badge } from "./components/ui";

export function ConnectionState({ isConnected, isReconnecting = false }) {
  if (isReconnecting) {
    return (
      <Badge variant="warning">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        Reconnecting…
      </Badge>
    );
  }

  return (
    <Badge variant={isConnected ? "success" : "danger"}>
      <span
        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
          isConnected ? "bg-emerald-500" : "bg-red-500"
        }`}
      />
      {isConnected ? "Connected" : "Disconnected"}
    </Badge>
  );
}
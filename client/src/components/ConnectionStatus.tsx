import React from "react";
import { useChatStore } from "../store/useChatStore";

export const ConnectionStatus: React.FC = () => {
  const isConnected = useChatStore((state) => state.isConnected);

  // A purely presentational component that subscribes only to the isConnected slice of Zustand to minimize render footprints.
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      {}
      <span
        className="inline-block w-2 h-2 shrink-0"
        aria-hidden="true"
        style={{
          background: isConnected
            ? "var(--color-foreground)"
            : "var(--color-muted-foreground)",
        }}
      />
      <span
        className="font-mono text-[10px] tracking-[0.2em] uppercase"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        {isConnected ? "ONLINE" : "CONNECTING"}
      </span>
    </div>
  );
};
export default ConnectionStatus;

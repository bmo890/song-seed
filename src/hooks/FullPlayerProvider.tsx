import React, { createContext, useContext, useEffect, useRef } from "react";
import { useFullPlayer } from "./useFullPlayer";
import { useStore } from "../state/useStore";

type FullPlayerValue = ReturnType<typeof useFullPlayer>;

const FullPlayerContext = createContext<FullPlayerValue | null>(null);

/**
 * Holds the single full-player audio engine, mounted once above the navigator
 * so playback persists across navigation. Both the PlayerScreen (full view) and
 * the GlobalMediaDock (mini view) read from this one engine, so minimizing the
 * player keeps audio playing and the dock controls reach the live transport.
 *
 * Plan A of the audio architecture: lift the full player to the root. (Inline
 * clip-card playback is still per-screen — Plan B unifies everything later.)
 */
export function FullPlayerProvider({ children }: { children: React.ReactNode }) {
  // Reverse direction: when the full player loads a new clip, stop any inline
  // clip-card playback so the two engines never overlap.
  const fullPlayer = useFullPlayer({
    onBeforePlayNew: () => {
      useStore.getState().requestInlineStop();
    },
  });

  // Interim cross-engine coordination (until Plan B unifies the engines):
  // anything that starts a *different* sound (inline clip-card playback, etc.)
  // calls requestPlayerClose(). Previously only the PlayerScreen handled that
  // token, so when the full player was minimized (screen unmounted) the request
  // was ignored and two clips played at once. Handle it here at the root so the
  // persistent engine always stops when something else takes over.
  const closeToken = useStore((s) => s.playerCloseRequestToken);
  const fullPlayerRef = useRef(fullPlayer);
  fullPlayerRef.current = fullPlayer;
  const handledCloseTokenRef = useRef(closeToken);
  useEffect(() => {
    if (closeToken === handledCloseTokenRef.current) return;
    handledCloseTokenRef.current = closeToken;
    void fullPlayerRef.current.closePlayer();
    useStore.getState().clearPlayerQueue();
  }, [closeToken]);

  return <FullPlayerContext.Provider value={fullPlayer}>{children}</FullPlayerContext.Provider>;
}

export function useFullPlayerContext(): FullPlayerValue {
  const ctx = useContext(FullPlayerContext);
  if (!ctx) {
    throw new Error("useFullPlayerContext must be used within a FullPlayerProvider");
  }
  return ctx;
}

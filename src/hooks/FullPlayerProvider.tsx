import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useFullPlayer } from "./useFullPlayer";
import { useInlinePlayer } from "./useInlinePlayer";
import { useStore } from "../state/useStore";
import type { InlinePlayerControls, InlinePlayerSnapshot } from "../types";

type FullPlayerValue = ReturnType<typeof useFullPlayer>;
type MiniPlayerValue = ReturnType<typeof useInlinePlayer>;

/** Just the transport *controls* — stable identities that never change on a
 *  playback tick. Consumers that only drive playback (the mini dock) use this so
 *  they don't re-render ~20×/sec, which would jank a concurrent drag/scroll. */
type FullPlayerControls = Pick<
  FullPlayerValue,
  "openPlayer" | "syncPlayerSource" | "togglePlayer" | "playPlayer" | "pausePlayer" | "closePlayer"
>;

const FullPlayerContext = createContext<FullPlayerValue | null>(null);
const FullPlayerControlsContext = createContext<FullPlayerControls | null>(null);
const MiniPlayerControlsContext = createContext<InlinePlayerControls | null>(null);

/**
 * Holds the root-owned user-facing playback engines above the navigator.
 *
 * The dock/full player and clip-card miniplayer remain separate UX concepts, but
 * this provider coordinates focus so only one session is audible at a time.
 */
export function FullPlayerProvider({ children }: { children: React.ReactNode }) {
  const rawDockRef = useRef<FullPlayerValue | null>(null);
  const miniRef = useRef<MiniPlayerValue | null>(null);

  const mini = useInlinePlayer({
    onBeforePlayNew: async () => {
      await rawDockRef.current?.pausePlayer();
    },
  });
  miniRef.current = mini;

  const rawDock = useFullPlayer({
    onBeforePlayNew: async () => {
      await miniRef.current?.resetInlinePlayer();
    },
  });
  rawDockRef.current = rawDock;

  const miniControls = useMemo<InlinePlayerControls>(() => {
    const snapshot = (): InlinePlayerSnapshot => {
      const current = miniRef.current;
      return {
        inlineTarget: current?.inlineTarget ?? null,
        inlinePosition: current?.inlinePosition ?? 0,
        inlineDuration: current?.inlineDuration ?? 0,
        isInlinePlaying: current?.isInlinePlaying ?? false,
      };
    };

    return {
      getSnapshot: snapshot,
      toggleInlinePlayback: async (...args: Parameters<MiniPlayerValue["toggleInlinePlayback"]>) => {
        await miniRef.current?.toggleInlinePlayback(...args);
      },
      beginInlineScrub: async () => {
        await miniRef.current?.beginInlineScrub();
      },
      endInlineScrub: async (...args: Parameters<MiniPlayerValue["endInlineScrub"]>) => {
        await miniRef.current?.endInlineScrub(...args);
      },
      cancelInlineScrub: async () => {
        await miniRef.current?.cancelInlineScrub();
      },
      seekInline: async (...args: Parameters<MiniPlayerValue["seekInline"]>) => {
        await miniRef.current?.seekInline(...args);
      },
      resetInlinePlayer: async () => {
        await miniRef.current?.resetInlinePlayer();
      },
    };
  }, []);

  // Stop an in-progress clip preview before the dock takes over audio output.
  // Stable identity (reads miniRef) so it never invalidates downstream effects.
  const stopMiniFirst = useCallback(async () => {
    if (!miniRef.current?.inlineTarget) return;
    await miniRef.current.resetInlinePlayer();
  }, []);

  // Dock control overrides that coordinate with the miniplayer. These are pinned
  // to STABLE identities (via refs, not the freshly-rebuilt rawDock object) so a
  // consumer's callback-keyed effects (PlayerScreen open/sync effects, etc.) do
  // NOT re-run on every ~50ms playback tick. Live STATE still flows because the
  // `dock` object below is rebuilt each render from rawDock.
  const openPlayer = useCallback<FullPlayerValue["openPlayer"]>(
    async (...args) => {
      await stopMiniFirst();
      return rawDockRef.current!.openPlayer(...args);
    },
    [stopMiniFirst]
  );
  const syncPlayerSource = useCallback<FullPlayerValue["syncPlayerSource"]>(
    async (...args) => {
      const shouldPlay = args[4] === true;
      if (shouldPlay) await stopMiniFirst();
      return rawDockRef.current!.syncPlayerSource(...args);
    },
    [stopMiniFirst]
  );
  const togglePlayer = useCallback<FullPlayerValue["togglePlayer"]>(async () => {
    if (!rawDockRef.current!.isPlayerPlaying) await stopMiniFirst();
    return rawDockRef.current!.togglePlayer();
  }, [stopMiniFirst]);
  const playPlayer = useCallback<FullPlayerValue["playPlayer"]>(async () => {
    await stopMiniFirst();
    return rawDockRef.current!.playPlayer();
  }, [stopMiniFirst]);
  // Pause + close don't coordinate with the miniplayer, but pin them too so the
  // stable controls object below never changes identity on a playback tick.
  const pausePlayer = useCallback<FullPlayerValue["pausePlayer"]>(
    (...args) => rawDockRef.current!.pausePlayer(...args),
    []
  );
  const closePlayer = useCallback<FullPlayerValue["closePlayer"]>(
    (...args) => rawDockRef.current!.closePlayer(...args),
    []
  );

  // `dock` identity changes each render so live playback state (position,
  // isPlaying, waveform) still reaches the few live consumers (player screen +
  // dock). Only the control functions above are held stable.
  const dock = useMemo<FullPlayerValue>(
    () => ({
      ...rawDock,
      openPlayer,
      syncPlayerSource,
      togglePlayer,
      playPlayer,
      pausePlayer,
      closePlayer,
    }),
    [rawDock, openPlayer, syncPlayerSource, togglePlayer, playPlayer, pausePlayer, closePlayer]
  );

  // Stable controls object — identity never changes on a playback tick, so the
  // mini dock (which only needs to drive transport) never re-renders at 20Hz.
  const controls = useMemo<FullPlayerControls>(
    () => ({ openPlayer, syncPlayerSource, togglePlayer, playPlayer, pausePlayer, closePlayer }),
    [openPlayer, syncPlayerSource, togglePlayer, playPlayer, pausePlayer, closePlayer]
  );

  // Legacy close requests still originate from screens that do not need direct
  // access to the dock engine. Handle them at the root so minimized playback
  // stops consistently.
  const closeToken = useStore((s) => s.playerCloseRequestToken);
  const dockRef = useRef(dock);
  dockRef.current = dock;
  const handledCloseTokenRef = useRef(closeToken);
  useEffect(() => {
    if (closeToken === handledCloseTokenRef.current) return;
    handledCloseTokenRef.current = closeToken;
    void dockRef.current.closePlayer();
    useStore.getState().clearPlayerQueue();
  }, [closeToken]);

  // ── Queue driver while minimized ──────────────────────────────────────────
  // The full Player screen owns queue loading + advancing while it's mounted.
  // When minimized (dock only), drive them here so the queue keeps playing,
  // auto-advances when a clip finishes, and responds to the dock's prev/next.
  const isPlayerScreenMounted = useStore((s) => s.isPlayerScreenMounted);
  const queueTarget = useStore((s) => s.playerTarget);

  // Load the queue's current target into the engine when it changes.
  useEffect(() => {
    if (isPlayerScreenMounted || !queueTarget) return;
    const engine = rawDockRef.current;
    if (!engine) return;
    // Already on this clip (e.g. just minimized) — don't reload.
    if (engine.playerTarget?.clipId === queueTarget.clipId && engine.currentPlaybackSourceUri) {
      return;
    }
    const idea = useStore
      .getState()
      .workspaces.flatMap((w) => w.ideas)
      .find((i) => i.id === queueTarget.ideaId);
    const clip = idea?.clips.find((c) => c.id === queueTarget.clipId);
    if (!idea || !clip) return;
    const shouldAutoplay = useStore.getState().playerShouldAutoplay;
    useStore.getState().consumePlayerAutoplay();
    void openPlayer(idea.id, clip, { title: clip.title, albumTitle: idea.title }, shouldAutoplay);
  }, [isPlayerScreenMounted, queueTarget, openPlayer]);

  // Auto-advance to the next clip when the current one finishes (mirrors the
  // Player screen's behavior: advance if there's a next track, else stay put).
  const finishedToken = rawDock.finishedPlaybackToken;
  const handledFinishTokenRef = useRef(finishedToken);
  useEffect(() => {
    if (finishedToken === handledFinishTokenRef.current) return;
    handledFinishTokenRef.current = finishedToken;
    if (isPlayerScreenMounted) return;
    const state = useStore.getState();
    if (state.playerQueue.length === 0) return;
    if (state.playerQueueIndex < state.playerQueue.length - 1) {
      state.advancePlayerQueue("next", true);
    }
  }, [finishedToken, isPlayerScreenMounted]);

  return (
    <FullPlayerContext.Provider value={dock}>
      <FullPlayerControlsContext.Provider value={controls}>
        <MiniPlayerControlsContext.Provider value={miniControls}>
          {children}
        </MiniPlayerControlsContext.Provider>
      </FullPlayerControlsContext.Provider>
    </FullPlayerContext.Provider>
  );
}

export function useFullPlayerContext(): FullPlayerValue {
  const ctx = useContext(FullPlayerContext);
  if (!ctx) {
    throw new Error("useFullPlayerContext must be used within a FullPlayerProvider");
  }
  return ctx;
}

/**
 * Transport controls only — a STABLE object that never changes on a playback
 * tick. Use this (not useFullPlayerContext) anywhere that only needs to drive
 * playback and must not re-render ~20×/sec (e.g. the mini dock).
 */
export function useFullPlayerControls(): FullPlayerControls {
  const ctx = useContext(FullPlayerControlsContext);
  if (!ctx) {
    throw new Error("useFullPlayerControls must be used within a FullPlayerProvider");
  }
  return ctx;
}

export function useMiniPlayerContext(): InlinePlayerControls {
  const ctx = useContext(MiniPlayerControlsContext);
  if (!ctx) {
    throw new Error("useMiniPlayerContext must be used within a FullPlayerProvider");
  }
  return ctx;
}

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Dimensions } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { useStore } from "../state/useStore";

const SCREEN_HEIGHT = Dimensions.get("window").height;

type PlayerSheetPosition = {
  /** Sheet vertical offset. 0 = fully open at the top, SCREEN_HEIGHT = docked
   *  off the bottom. Written by the header drag-down (collapse), the dock
   *  drag-up (expand), and the open/close animations. */
  dragY: SharedValue<number>;
  /** The docked resting offset = SCREEN_HEIGHT - dockHeight, i.e. the sheet's top
   *  sits exactly at the media dock's top edge (hidden behind it). The drag-up
   *  starts from here so the sheet emerges above the dock immediately — no dead
   *  travel from the screen bottom. Kept in sync with the measured dock height. */
  dockedY: SharedValue<number>;
  /** Set true by the dock drag-up BEFORE it mounts the sheet, so the sheet's
   *  mount effect skips its auto-open animation and lets the finger drive. */
  openedByDrag: SharedValue<boolean>;
  /** Freezes the player's React subtree while the sheet is animating/dragging
   *  (React state so it actually triggers the cached-tree re-render). */
  inMotion: boolean;
  setInMotion: (value: boolean) => void;
  screenHeight: number;
};

const PlayerSheetPositionContext = createContext<PlayerSheetPosition | null>(null);

/** Owns the shared vertical position of the player sheet so the media dock
 *  (drag up to expand) and the sheet (drag down to collapse) drive one value —
 *  they behave as a single component at two heights. Wraps the dock + sheet. */
export function PlayerSheetPositionProvider({ children }: { children: React.ReactNode }) {
  const dragY = useSharedValue(SCREEN_HEIGHT);
  const dockedY = useSharedValue(SCREEN_HEIGHT);
  const openedByDrag = useSharedValue(false);
  const [inMotion, setInMotion] = useState(false);

  // Keep the docked resting offset one dock-height off the bottom, so a swipe-up
  // lifts the sheet straight out from behind the dock's top edge.
  //
  // Deliberately does NOT account for a selection toolbar lifting the dock. Moving a
  // full-height sheet up doesn't shorten it — its body still covers the toolbar, and
  // its header pokes out below the dock (tried; looked worse). The docked sheet is
  // hidden outright while a toolbar is up instead — see shouldObscurePlayerSheet. If
  // the sheet is RESTING at the docked offset when the dock height changes, move it in
  // the same frame; an expanded or mid-drag sheet only retargets.
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  useEffect(() => {
    const next = Math.max(0, SCREEN_HEIGHT - playerDockHeight);
    const wasResting = dragY.value === dockedY.value;
    dockedY.value = next;
    if (wasResting) dragY.value = next;
  }, [dockedY, dragY, playerDockHeight]);

  const value = useMemo<PlayerSheetPosition>(
    () => ({ dragY, dockedY, openedByDrag, inMotion, setInMotion, screenHeight: SCREEN_HEIGHT }),
    [dragY, dockedY, openedByDrag, inMotion]
  );

  return (
    <PlayerSheetPositionContext.Provider value={value}>{children}</PlayerSheetPositionContext.Provider>
  );
}

export function usePlayerSheetPosition() {
  const context = useContext(PlayerSheetPositionContext);
  if (!context) {
    throw new Error("usePlayerSheetPosition must be used within a PlayerSheetPositionProvider");
  }
  return context;
}

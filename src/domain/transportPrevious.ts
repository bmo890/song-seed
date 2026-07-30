/**
 * What the PREVIOUS button does.
 *
 * The standard convention across every music player people already know: press it and you go
 * back to the start of what you're listening to; press it again — or press it when you're
 * already at the start — and you go to the previous item. Restarting is the common case, so
 * it gets the single press.
 *
 * This lived only in the lock-screen command handler, so the in-app prev button and the media
 * dock skipped straight to the previous clip and there was no way to get back to the top of a
 * take with one thumb. One rule now, shared by every surface that has the button.
 */

/** Past this far into a clip, prev restarts it instead of leaving it. */
export const PREVIOUS_RESTART_MS = 3000;

export type PreviousAction = "restart" | "previousItem";

export function resolvePreviousAction(args: {
    positionMs: number;
    hasPreviousItem: boolean;
}): PreviousAction {
    const { positionMs, hasPreviousItem } = args;
    if (!hasPreviousItem) return "restart";
    return positionMs > PREVIOUS_RESTART_MS ? "restart" : "previousItem";
}

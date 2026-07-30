/**
 * The gates that decide whether a reported playback position is worth believing.
 *
 * These used to live inline in the render path — `useFullPlayer` computed the held
 * position while rendering, and `useTransportClock` decided in an effect whether to write
 * the shared value. That coupled the reel's position feed to React's commit cadence, which
 * is what tore the reel's overlays off the tape (docs/product-plan/reel-smoothness-findings.md).
 * The position now travels straight from the audio status listener to the shared value, so
 * these rules have to run outside render — hence: pure functions, no refs, no clock reads.
 *
 * Both are deliberately dumb about time: the caller passes `nowMs`. That is what makes the
 * cases they exist for — a stale position surviving a source swap, a seek flickering back
 * to where it came from — testable rather than a thing you can only meet on a device.
 */

/** What a position report carries. `isPlaying` and `playbackRate` ride along rather than
 *  being read from props, so a subscriber never has to wait for a render to learn them. */
export type TransportPositionReport = {
    positionMs: number;
    isPlaying: boolean;
    playbackRate: number;
};

export type TransportPositionChannel = {
    publish: (report: TransportPositionReport) => void;
    subscribe: (listener: (report: TransportPositionReport) => void) => () => void;
};

/**
 * The path position takes from the audio engine to the reel, bypassing React entirely.
 *
 * Deliberately not a store, a context value or anything else that can cause a render:
 * a React commit landing mid-animation is precisely what knocks the reel's overlays out of
 * step with its canvas, and position reports arrive ~20×/second.
 */
export function createTransportPositionChannel(): TransportPositionChannel {
    const listeners = new Set<(report: TransportPositionReport) => void>();
    return {
        publish(report) {
            // Copy first: a listener that unsubscribes mid-notify must not skip the next one.
            for (const listener of Array.from(listeners)) {
                listener(report);
            }
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

export type SourcePositionHold = {
    /** Where the transport was told to be. */
    targetMs: number;
    /** Wall-clock deadline; past this the engine has had long enough. */
    until: number;
    /** True once the engine's own reports have caught up to the target. */
    accepted: boolean;
};

export type SourceHoldResolution = {
    /** The position to show. */
    positionMs: number;
    /** The engine has arrived — the caller should mark the hold accepted. */
    shouldAccept: boolean;
};

/**
 * After a source swap or a seek, the engine keeps reporting the OLD position for a while.
 * Show the target instead until its own reports agree, or until the deadline passes.
 */
export function resolveSourcePositionHold(
    rawPositionMs: number,
    hold: SourcePositionHold | null,
    nowMs: number,
    toleranceMs: number
): SourceHoldResolution {
    if (!hold || hold.accepted) {
        return { positionMs: rawPositionMs, shouldAccept: false };
    }

    const hasArrived = Math.abs(rawPositionMs - hold.targetMs) <= toleranceMs;
    const hasTimedOut = nowMs >= hold.until;

    if (hasArrived) {
        return { positionMs: rawPositionMs, shouldAccept: true };
    }
    if (hasTimedOut) {
        // Believe the engine again rather than sitting on a target it never reached.
        return { positionMs: rawPositionMs, shouldAccept: true };
    }
    return { positionMs: hold.targetMs, shouldAccept: false };
}

export type PendingDisplaySeek = {
    /** Where the playhead was when the seek was issued. */
    sourceMs: number;
    /** Where the user asked it to go. */
    targetMs: number;
    /** Wall-clock deadline. */
    until: number;
};

export type ClockPositionInput = {
    positionMs: number;
    isPlaying: boolean;
    /** Where a source reset parks the playhead (normally 0). */
    resetPositionMs: number;
    /** Wall-clock deadline of the post-reset hold; 0 when none is active. */
    resetHoldUntil: number;
    pendingSeek: PendingDisplaySeek | null;
    playbackRate: number;
    nowMs: number;
};

export type ClockPositionResolution = {
    /** Whether to publish this position to the visual clock at all. */
    shouldWrite: boolean;
    positionMs: number;
    /** The reset hold has served its purpose and should be cleared. */
    clearResetHold: boolean;
    /** The seek has landed (or given up waiting) and should be cleared. */
    clearPendingSeek: boolean;
    /** Whether the caller should record this as the latest engine-reported position,
     *  which it does even for reports it declines to display. */
    recordAsNativePosition: boolean;
};

/** Tolerance for "this report is the reset position we asked for". */
export const SOURCE_RESET_POSITION_TOLERANCE_MS = 90;

/**
 * Decide whether a reported position should move the visual playhead.
 *
 * Two things can veto it:
 *  - a reset hold: the source just changed, and while it is settling a paused engine can
 *    still report the OUTGOING clip's position. Showing it would flash the new clip at the
 *    old clip's time.
 *  - a pending seek: between committing a seek and the engine arriving, reports still read
 *    as the position we came FROM. Showing those bounces the playhead back before it jumps.
 */
export function resolveClockPosition({
    positionMs,
    isPlaying,
    resetPositionMs,
    resetHoldUntil,
    pendingSeek,
    playbackRate,
    nowMs,
}: ClockPositionInput): ClockPositionResolution {
    const resetHoldActive = nowMs < resetHoldUntil;
    const isWithinResetTolerance =
        Math.abs(positionMs - resetPositionMs) <= SOURCE_RESET_POSITION_TOLERANCE_MS;

    if (resetHoldActive && !isPlaying && !isWithinResetTolerance) {
        return {
            shouldWrite: false,
            positionMs,
            clearResetHold: false,
            clearPendingSeek: false,
            recordAsNativePosition: false,
        };
    }

    const clearResetHold = resetHoldActive && !isPlaying && isWithinResetTolerance;

    if (pendingSeek) {
        const toleranceMs = Math.max(60, Math.round(140 * playbackRate));
        const hasReachedTarget = Math.abs(positionMs - pendingSeek.targetMs) <= toleranceMs;
        const stillLooksLikeSource = Math.abs(positionMs - pendingSeek.sourceMs) <= toleranceMs;
        const hasTimedOut = nowMs >= pendingSeek.until;

        if (!hasReachedTarget && stillLooksLikeSource && !hasTimedOut) {
            return {
                shouldWrite: false,
                positionMs,
                clearResetHold,
                clearPendingSeek: false,
                recordAsNativePosition: true,
            };
        }

        return {
            shouldWrite: true,
            positionMs,
            clearResetHold,
            clearPendingSeek: true,
            recordAsNativePosition: true,
        };
    }

    return {
        shouldWrite: true,
        positionMs,
        clearResetHold,
        clearPendingSeek: false,
        recordAsNativePosition: true,
    };
}

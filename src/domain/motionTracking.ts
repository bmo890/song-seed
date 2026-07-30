/**
 * α-β tracking filter — the reel's scroll clock.
 *
 * Every moving tape in the app follows a clock it does not own: playback follows the
 * audio player's position reports (~20/s), live recording follows the arrival of captured
 * audio segments (~25/s). Both arrive as a STAIRCASE, while the thing they describe is a
 * smooth ramp. Painting the staircase — or re-anchoring a ramp to it on every report —
 * makes the tape accelerate from a near-standstill several times a second. The waveform
 * hides that (one candle looks like the next); an isolated bar line, section edge, or pin
 * does not, which is where the stepping was visible.
 *
 * The α-β filter (the standard radar / A-V-sync tracker) carries its own VELOCITY estimate
 * and folds each report in as a small residual:
 *
 *   position += velocity · Δt + α · residual
 *   velocity += β · residual / Δt
 *
 * Against a constant-velocity input it settles at zero lag with a smooth velocity, which
 * is exactly the property a scrolling tape needs. α is derived from the real frame delta
 * so the feel is identical at 60Hz and 120Hz; β follows the standard α²/(2−α) relation,
 * which is critically damped (no ringing, no overshoot hunting).
 *
 * Pure and RN-free so the behaviour is unit-testable; marked as a worklet so the UI thread
 * can call it directly from a frame callback.
 */

export type TrackerOptions = {
    /** Convergence time constant in ms. Larger = smoother but slower to correct. */
    tauMs: number;
    /** Ceiling on the velocity estimate, in position units per ms. Runaway guard. */
    maxVelocity: number;
    /** Residual past which this isn't drift but a jump (a seek, a new take): land on it. */
    resyncDistance: number;
    /** Velocity to adopt after a resync — the nominal rate of the thing being followed. */
    resyncVelocity: number;
};

export type TrackerState = {
    position: number;
    velocity: number;
    /** True when this step jumped rather than tracked (callers may skip smoothing). */
    resynced: boolean;
};

/**
 * One frame of tracking. `target` is where the followed clock says we should be RIGHT NOW
 * (callers extrapolate their last report forward at the nominal rate before calling, so
 * the tracker sees a line rather than steps).
 */
export function advanceTracker(
    position: number,
    velocity: number,
    target: number,
    frameDeltaMs: number,
    options: TrackerOptions
): TrackerState {
    "worklet";
    if (!(frameDeltaMs > 0)) {
        return { position, velocity, resynced: false };
    }

    const coasted = position + velocity * frameDeltaMs;
    const residual = target - coasted;

    if (Math.abs(residual) > options.resyncDistance) {
        return { position: target, velocity: options.resyncVelocity, resynced: true };
    }

    const alpha = 1 - Math.exp(-frameDeltaMs / options.tauMs);
    const beta = (alpha * alpha) / (2 - alpha);
    const nextVelocity = Math.max(
        0,
        Math.min(options.maxVelocity, velocity + (residual * beta) / frameDeltaMs)
    );

    return {
        position: coasted + residual * alpha,
        velocity: nextVelocity,
        resynced: false,
    };
}

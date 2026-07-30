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
    /**
     * Ceiling on how fast the tape may actually MOVE, in position units per ms.
     *
     * `maxVelocity` bounds the carried velocity estimate, but the per-frame position step is
     * `velocity·Δt + residual·α`, and that second term is not velocity — a residual closes at
     * roughly `residual/tau` on top of the nominal rate, so a 400ms debt at tau=130ms plays
     * back at about 4× real time for a quarter of a second. That is the "speeds up to catch
     * up" after a scrub: the tape paying off a debt it accrued while it was held still.
     *
     * A genuine discontinuity (a seek landing) should be a JUMP, not a sprint — callers snap
     * for those. Everything else is drift, and drift must close at a rate the eye reads as
     * normal motion. Defaults to unbounded so existing behaviour is opt-in only.
     */
    maxStepRate?: number;
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

    let step = velocity * frameDeltaMs + residual * alpha;
    const maxStepRate = options.maxStepRate;
    if (maxStepRate != null && maxStepRate > 0) {
        const maxStep = maxStepRate * frameDeltaMs;
        step = Math.max(-maxStep, Math.min(maxStep, step));
    }

    return {
        position: position + step,
        velocity: nextVelocity,
        resynced: false,
    };
}

import { advanceTracker, type TrackerOptions } from "../motionTracking";

const OPTIONS: TrackerOptions = {
    tauMs: 130,
    maxVelocity: 3,
    resyncDistance: 1000,
    resyncVelocity: 1,
};

/**
 * Drive the tracker the way a reel does: a clock that only reports every `reportEveryMs`,
 * extrapolated forward at the nominal rate between reports (the staircase the tracker is
 * built to smooth). Returns the per-frame advances so we can look at VELOCITY, which is
 * what the eye actually reads as smooth or juddery.
 */
function runTape({
    frameMs,
    reportEveryMs,
    durationMs,
    rate = 1,
}: {
    frameMs: number;
    reportEveryMs: number;
    durationMs: number;
    rate?: number;
}) {
    let position = 0;
    let velocity = rate;
    let lastReportValue = 0;
    let lastReportAt = 0;
    let clock = 0;
    const advances: number[] = [];

    while (clock < durationMs) {
        clock += frameMs;
        if (clock - lastReportAt >= reportEveryMs) {
            // The report describes where the source was when it was generated.
            lastReportValue = clock * rate;
            lastReportAt = clock;
        }
        const target = lastReportValue + (clock - lastReportAt) * rate;
        const previous = position;
        const next = advanceTracker(position, velocity, target, frameMs, OPTIONS);
        position = next.position;
        velocity = next.velocity;
        advances.push(position - previous);
    }

    return { position, velocity, advances, clock };
}

describe("advanceTracker", () => {
    it("settles on a constant-velocity source with no standing lag", () => {
        const { position, velocity, clock } = runTape({
            frameMs: 1000 / 60,
            reportEveryMs: 50,
            durationMs: 4000,
        });
        // Zero-lag tracking of a ramp is the whole point of carrying a velocity term.
        expect(Math.abs(position - clock)).toBeLessThan(12);
        expect(velocity).toBeCloseTo(1, 1);
    });

    it("keeps per-frame motion even across the staircase of position reports", () => {
        const frameMs = 1000 / 60;
        const { advances } = runTape({ frameMs, reportEveryMs: 50, durationMs: 4000 });
        // Ignore the lock-on frames; judge the steady state.
        const settled = advances.slice(60);
        const slowest = Math.min(...settled);
        const fastest = Math.max(...settled);

        // The regression this filter exists to kill: re-anchoring the ramp to the painted
        // position on every report made the tape restart from ~zero velocity 20×/second.
        // Nothing here may drop near a standstill, or speed up to cover for it.
        expect(slowest).toBeGreaterThan(frameMs * 0.85);
        expect(fastest).toBeLessThan(frameMs * 1.15);
    });

    it("behaves the same at 60Hz and at 120Hz", () => {
        const sixty = runTape({ frameMs: 1000 / 60, reportEveryMs: 50, durationMs: 4000 });
        const oneTwenty = runTape({ frameMs: 1000 / 120, reportEveryMs: 50, durationMs: 4000 });

        // Compare the LAG behind each run's own clock — the two runs stop on different
        // frame boundaries, so their absolute positions legitimately differ by a frame.
        // Deriving alpha from the real frame delta is what makes the lag match; a fixed
        // per-frame gain converges half as fast on a ProMotion display.
        const sixtyLag = sixty.position - sixty.clock;
        const oneTwentyLag = oneTwenty.position - oneTwenty.clock;
        expect(Math.abs(sixtyLag - oneTwentyLag)).toBeLessThan(6);
        expect(oneTwenty.velocity).toBeCloseTo(sixty.velocity, 1);
    });

    it("tracks a half-speed source at half speed", () => {
        const { velocity, position, clock } = runTape({
            frameMs: 1000 / 60,
            reportEveryMs: 50,
            durationMs: 4000,
            rate: 0.5,
        });
        expect(velocity).toBeCloseTo(0.5, 1);
        expect(Math.abs(position - clock * 0.5)).toBeLessThan(12);
    });

    it("jumps rather than crawls when the source leaps (a seek)", () => {
        const step = advanceTracker(1000, 1, 40_000, 1000 / 60, OPTIONS);
        expect(step.resynced).toBe(true);
        expect(step.position).toBe(40_000);
        expect(step.velocity).toBe(OPTIONS.resyncVelocity);
    });

    it("absorbs report jitter instead of passing it through", () => {
        const frameMs = 1000 / 60;
        let position = 0;
        let velocity = 1;
        const advances: number[] = [];
        // ±25ms of delivery jitter on top of a clean ramp — the JS thread arriving late.
        const jitter = [0, 25, -18, 12, -25, 7, 20, -10];
        for (let frame = 1; frame <= 240; frame += 1) {
            const clock = frame * frameMs;
            const target = clock + jitter[frame % jitter.length];
            const previous = position;
            const next = advanceTracker(position, velocity, target, frameMs, OPTIONS);
            position = next.position;
            velocity = next.velocity;
            advances.push(position - previous);
        }
        const settled = advances.slice(60);
        expect(Math.min(...settled)).toBeGreaterThan(frameMs * 0.5);
        expect(Math.max(...settled)).toBeLessThan(frameMs * 1.5);
    });

    it("never runs backwards and never runs away", () => {
        const braking = advanceTracker(10_000, 1, 9_990, 1000 / 60, OPTIONS);
        expect(braking.velocity).toBeGreaterThanOrEqual(0);

        const bolting = advanceTracker(0, 3, 900, 1000 / 60, {
            ...OPTIONS,
            maxVelocity: 2,
        });
        expect(bolting.velocity).toBeLessThanOrEqual(2);
    });

    it("is a no-op on a zero-length frame", () => {
        const step = advanceTracker(500, 1, 900, 0, OPTIONS);
        expect(step.position).toBe(500);
        expect(step.velocity).toBe(1);
        expect(step.resynced).toBe(false);
    });

    /**
     * The scrub sprint. `maxVelocity` bounds the carried velocity estimate but NOT the
     * per-frame correction term, so a debt accrued while the tape was held still (a scrub
     * settle, a play-start grace) was paid back by running the tape at several times real
     * speed for a few hundred ms. That is what "it speeds up to catch up" was.
     */
    describe("closing a debt after a hold", () => {
        const frameMs = 1000 / 60;
        /** Peak on-screen speed, as a multiple of real time, while closing `debtMs`. */
        function peakSpeed(debtMs: number, options: TrackerOptions) {
            let position = 0;
            let velocity = 1;
            let peak = 0;
            for (let frame = 0; frame < 60; frame += 1) {
                const target = debtMs + (frame + 1) * frameMs;
                const next = advanceTracker(position, velocity, target, frameMs, options);
                peak = Math.max(peak, (next.position - position) / frameMs);
                position = next.position;
                velocity = next.velocity;
            }
            return peak;
        }

        it("sprints when the step rate is unbounded", () => {
            // 400ms of debt at tau=130ms is roughly 400/130 ≈ 3× on top of nominal.
            expect(peakSpeed(400, { ...OPTIONS, resyncDistance: 10_000 })).toBeGreaterThan(3);
        });

        it("stays at a readable speed when the step rate is capped", () => {
            const capped = peakSpeed(400, {
                ...OPTIONS,
                resyncDistance: 10_000,
                maxStepRate: 1.4,
            });
            expect(capped).toBeLessThanOrEqual(1.4 + 1e-9);
        });

        it("still closes the debt, just without the sprint", () => {
            let position = 0;
            let velocity = 1;
            const options = { ...OPTIONS, resyncDistance: 10_000, maxStepRate: 1.4 };
            for (let frame = 0; frame < 200; frame += 1) {
                const target = 400 + (frame + 1) * frameMs;
                const next = advanceTracker(position, velocity, target, frameMs, options);
                position = next.position;
                velocity = next.velocity;
            }
            expect(Math.abs(position - (400 + 200 * frameMs))).toBeLessThan(5);
        });

        it("leaves ordinary tracking untouched", () => {
            // A capped tape and an uncapped one must be indistinguishable at nominal speed.
            const options = { ...OPTIONS, maxStepRate: 1.4 };
            let a = 0;
            let b = 0;
            let va = 1;
            let vb = 1;
            for (let frame = 0; frame < 120; frame += 1) {
                const target = (frame + 1) * frameMs;
                const stepA = advanceTracker(a, va, target, frameMs, OPTIONS);
                const stepB = advanceTracker(b, vb, target, frameMs, options);
                a = stepA.position;
                va = stepA.velocity;
                b = stepB.position;
                vb = stepB.velocity;
            }
            expect(Math.abs(a - b)).toBeLessThan(1e-9);
        });
    });
});

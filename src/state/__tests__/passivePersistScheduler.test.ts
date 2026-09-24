import { createPassivePersistScheduler } from "../passivePersistScheduler";

describe("createPassivePersistScheduler", () => {
    let held: Array<() => void>;
    let run: jest.Mock;
    const gate = (work: () => void) => {
        held.push(work);
    };
    const releaseGate = () => {
        const work = held.splice(0);
        work.forEach((fn) => fn());
    };

    beforeEach(() => {
        jest.useFakeTimers();
        held = [];
        run = jest.fn();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    const make = () => createPassivePersistScheduler({ debounceMs: 800, maxWaitMs: 4000, run, gate });

    it("coalesces a burst into one trailing write", () => {
        const s = make();
        const w1 = jest.fn();
        const w2 = jest.fn();
        s.schedule(w1);
        jest.advanceTimersByTime(500);
        s.schedule(w2);
        jest.advanceTimersByTime(799);
        expect(held).toHaveLength(0);
        jest.advanceTimersByTime(1);
        expect(held).toHaveLength(1);
        releaseGate();
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith(w2);
    });

    it("a direct flush can still take the write while it waits on the gate", () => {
        // The snapshot inside a passive write is as old as its set(); once a flush built
        // from newer state has run, that older snapshot must never land after it.
        const s = make();
        const stale = jest.fn();
        s.schedule(stale);
        jest.advanceTimersByTime(800);
        expect(held).toHaveLength(1);
        expect(s.take()).toBe(stale);
        releaseGate();
        expect(run).not.toHaveBeenCalled();
        expect(s.hasPending()).toBe(false);
    });

    it("a newer passive write scheduled during the gate replaces the older one", () => {
        const s = make();
        const older = jest.fn();
        const newer = jest.fn();
        s.schedule(older);
        jest.advanceTimersByTime(800);
        s.schedule(newer);
        releaseGate();
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith(newer);
        // The newer write's own timer finds nothing left to do.
        jest.advanceTimersByTime(800);
        releaseGate();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("a continuous stream of writes cannot postpone the write past the max wait", () => {
        const s = make();
        for (let t = 0; t < 4000; t += 100) {
            s.schedule(jest.fn());
            jest.advanceTimersByTime(100);
        }
        expect(held.length).toBeGreaterThanOrEqual(1);
    });

    it("flushNow runs immediately, bypassing the gate", () => {
        const s = make();
        const w = jest.fn();
        s.schedule(w);
        s.flushNow();
        expect(run).toHaveBeenCalledWith(w);
        jest.advanceTimersByTime(800);
        expect(held).toHaveLength(0);
    });
});

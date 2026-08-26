import {
    isPersistFailing,
    onPersistFailingChange,
    reportPersistWriteFailure,
    reportPersistWriteSuccess,
} from "../persistRuntime";

describe("persist write-failure signal (2026-08-26 audit F5)", () => {
    beforeEach(() => {
        reportPersistWriteSuccess(); // reset counter + flag between tests
    });

    it("stays quiet below the consecutive-failure threshold", () => {
        reportPersistWriteFailure();
        reportPersistWriteFailure();
        expect(isPersistFailing()).toBe(false);
    });

    it("raises after three consecutive dual-store failures", () => {
        reportPersistWriteFailure();
        reportPersistWriteFailure();
        reportPersistWriteFailure();
        expect(isPersistFailing()).toBe(true);
    });

    it("a single landed write clears both the flag and the streak", () => {
        reportPersistWriteFailure();
        reportPersistWriteFailure();
        reportPersistWriteFailure();
        reportPersistWriteSuccess();
        expect(isPersistFailing()).toBe(false);
        // The streak restarts from zero — two more failures must not re-raise.
        reportPersistWriteFailure();
        reportPersistWriteFailure();
        expect(isPersistFailing()).toBe(false);
    });

    it("replays the current value to a new listener and notifies on change", () => {
        const seen: boolean[] = [];
        const unsubscribe = onPersistFailingChange((failing) => seen.push(failing));
        expect(seen).toEqual([false]);

        reportPersistWriteFailure();
        reportPersistWriteFailure();
        reportPersistWriteFailure();
        reportPersistWriteFailure(); // repeated failures notify once, not per call
        expect(seen).toEqual([false, true]);

        reportPersistWriteSuccess();
        expect(seen).toEqual([false, true, false]);
        unsubscribe();
    });
});

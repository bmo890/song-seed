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

describe("persist health (2026-09-07: no silent write outcome)", () => {
    const runtime = require("../persistRuntime") as typeof import("../persistRuntime");

    beforeEach(() => {
        runtime.reportPersistWriteSuccess();
        runtime.clearPersistBlockedSignal();
    });

    it("turns degraded after repeated fallback-only writes and clears on a SQLite write", () => {
        runtime.reportPersistWriteFallback();
        runtime.reportPersistWriteFallback();
        expect(runtime.getPersistHealth()).toBe("ok");
        runtime.reportPersistWriteFallback();
        expect(runtime.getPersistHealth()).toBe("degraded");
        runtime.reportPersistWriteSuccess();
        expect(runtime.getPersistHealth()).toBe("ok");
    });

    it("blocked outranks everything and stays until deliberately cleared", () => {
        runtime.reportPersistBlocked("guard");
        runtime.reportPersistWriteSuccess();
        expect(runtime.getPersistHealth()).toBe("blocked");
        runtime.clearPersistBlockedSignal();
        expect(runtime.getPersistHealth()).toBe("ok");
    });

    it("notifies health listeners once per transition", () => {
        const seen: string[] = [];
        const unsubscribe = runtime.onPersistHealthChange((health) => seen.push(health));
        for (let i = 0; i < 4; i += 1) runtime.reportPersistWriteFallback();
        runtime.reportPersistBlocked("authority");
        runtime.clearPersistBlockedSignal();
        expect(seen).toEqual(["ok", "degraded", "blocked", "degraded"]);
        unsubscribe();
    });
});

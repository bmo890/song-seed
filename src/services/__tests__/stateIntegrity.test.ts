import {
    authorizeIntentionalEmptyStateWrite,
    consumeIntentionalEmptyStateWrite,
} from "../stateIntegrity";

/**
 * A grant covers `steps` guarded writes inside its window — the persist guard and
 * the manifest mirror each take one. It used to be a bare 60 s window that no
 * consume ever consumed (2026-10-22 sweep, P3-4).
 */
describe("intentional empty/bulk-drop write authorization", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("refuses when nothing was authorized", () => {
        authorizeIntentionalEmptyStateWrite(0);
        expect(consumeIntentionalEmptyStateWrite()).toBe(false);
    });

    it("grants exactly `steps` consumes, then refuses", () => {
        authorizeIntentionalEmptyStateWrite(2);
        expect(consumeIntentionalEmptyStateWrite()).toBe(true);
        expect(consumeIntentionalEmptyStateWrite()).toBe(true);
        expect(consumeIntentionalEmptyStateWrite()).toBe(false);
        expect(consumeIntentionalEmptyStateWrite()).toBe(false);
    });

    it("a fresh grant replaces what was left, and the default covers four", () => {
        authorizeIntentionalEmptyStateWrite(1);
        authorizeIntentionalEmptyStateWrite();
        for (let i = 0; i < 4; i += 1) expect(consumeIntentionalEmptyStateWrite()).toBe(true);
        expect(consumeIntentionalEmptyStateWrite()).toBe(false);
    });

    it("the grant expires with its window, consumed or not", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-10-22T10:00:00Z"));
        authorizeIntentionalEmptyStateWrite(6);
        expect(consumeIntentionalEmptyStateWrite()).toBe(true);
        jest.setSystemTime(new Date("2026-10-22T10:01:01Z"));
        expect(consumeIntentionalEmptyStateWrite()).toBe(false);
        // Expiry clears the remaining steps, not only the deadline.
        expect(consumeIntentionalEmptyStateWrite()).toBe(false);
    });
});

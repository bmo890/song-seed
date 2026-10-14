import { describeInstalledUpdate } from "../installedUpdate";

const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10);

describe("describeInstalledUpdate", () => {
    it("names the update by a short id and its date", () => {
        expect(
            describeInstalledUpdate(
                { updateId: "7b2c1d9e-1234-4abc-9def-000000000000", createdAt: new Date("2026-10-14T10:00:00Z"), isEmbeddedLaunch: false },
                fmt
            )
        ).toBe("7b2c1d · 2026-10-14");
    });
    it("drops the date when none is known", () => {
        expect(describeInstalledUpdate({ updateId: "abcdef00", createdAt: null, isEmbeddedLaunch: false }, fmt)).toBe("abcdef");
    });
    it("says nothing on the embedded bundle", () => {
        expect(describeInstalledUpdate({ updateId: "x", createdAt: null, isEmbeddedLaunch: true }, fmt)).toBeNull();
        expect(describeInstalledUpdate({ updateId: null, createdAt: null, isEmbeddedLaunch: false }, fmt)).toBeNull();
    });
});

import {
    FREE_OVERDUB_LAYERS,
    FREE_SPARK_TRIES_PER_GAME,
    canAddOverdubLayer,
    canStartSpark,
} from "../domain/proGating";

describe("canAddOverdubLayer", () => {
    it("lets a free user add the first layer but not a second", () => {
        expect(canAddOverdubLayer(0, false)).toBe(true); // bare clip → first layer free
        expect(canAddOverdubLayer(FREE_OVERDUB_LAYERS, false)).toBe(false); // second → Pro
        expect(canAddOverdubLayer(3, false)).toBe(false);
    });

    it("lets a Pro user add layers without limit", () => {
        expect(canAddOverdubLayer(0, true)).toBe(true);
        expect(canAddOverdubLayer(5, true)).toBe(true);
    });
});

describe("canStartSpark", () => {
    it("gives a free user three tries of a game, then gates", () => {
        expect(canStartSpark(0, false)).toBe(true);
        expect(canStartSpark(FREE_SPARK_TRIES_PER_GAME - 1, false)).toBe(true); // the third try
        expect(canStartSpark(FREE_SPARK_TRIES_PER_GAME, false)).toBe(false); // a fourth → Pro
    });

    it("never gates Pro (or the free month)", () => {
        expect(canStartSpark(FREE_SPARK_TRIES_PER_GAME, true)).toBe(true);
        expect(canStartSpark(1000, true)).toBe(true);
    });
});

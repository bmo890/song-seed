import {
    FREE_OVERDUB_LAYERS,
    FREE_SAVED_SPARKS_PER_TOOL,
    canAddOverdubLayer,
    canSaveWordSpark,
    remainingFreeSparks,
} from "../proGating";

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

describe("canSaveWordSpark", () => {
    it("lets a free user save up to the per-tool limit, then gates", () => {
        expect(canSaveWordSpark(0, false)).toBe(true);
        expect(canSaveWordSpark(FREE_SAVED_SPARKS_PER_TOOL - 1, false)).toBe(true); // saving the 5th
        expect(canSaveWordSpark(FREE_SAVED_SPARKS_PER_TOOL, false)).toBe(false); // 6th → Pro
        expect(canSaveWordSpark(99, false)).toBe(false);
    });

    it("lets a Pro user save without limit", () => {
        expect(canSaveWordSpark(FREE_SAVED_SPARKS_PER_TOOL, true)).toBe(true);
        expect(canSaveWordSpark(1000, true)).toBe(true);
    });
});

describe("remainingFreeSparks", () => {
    it("counts down and floors at zero", () => {
        expect(remainingFreeSparks(0)).toBe(FREE_SAVED_SPARKS_PER_TOOL);
        expect(remainingFreeSparks(3)).toBe(FREE_SAVED_SPARKS_PER_TOOL - 3);
        expect(remainingFreeSparks(FREE_SAVED_SPARKS_PER_TOOL)).toBe(0);
        expect(remainingFreeSparks(FREE_SAVED_SPARKS_PER_TOOL + 10)).toBe(0);
    });
});

/**
 * Pure gate-decision logic for the free/Pro split (Phase 6). Kept separate from
 * entitlements.ts (the reactive seam) and from React so the limits are unit-testable in
 * isolation: each function takes the current count + the caller's resolved `isPro`
 * (from hasProAccess / useHasProAccess) and returns a plain decision.
 *
 * Invariant: these gate CREATING NEW Pro-tier content only. Opening, playing, or editing
 * content the user already has (existing multi-layer clips, already-saved sparks) is never
 * gated — callers must not run these checks on the read/edit paths.
 */

/** Overdub layers a free user may add per clip. The first layer is free; a second needs Pro. */
export const FREE_OVERDUB_LAYERS = 1;

/** Saved word-tool sparks a free user may keep PER TOOL (WordLadder / Cut-Up / Magpie). */
export const FREE_SAVED_SPARKS_PER_TOOL = 5;

/**
 * Whether the user may add another overdub layer. `existingLayerCount` is how many overdub
 * layers the clip already has (0 for a bare clip). Free users get FREE_OVERDUB_LAYERS.
 */
export function canAddOverdubLayer(existingLayerCount: number, isPro: boolean): boolean {
    return isPro || existingLayerCount < FREE_OVERDUB_LAYERS;
}

/**
 * Whether the user may save another spark in a given tool. `savedCount` is how many sparks
 * are already saved IN THAT TOOL. Free users get FREE_SAVED_SPARKS_PER_TOOL.
 */
export function canSaveWordSpark(savedCount: number, isPro: boolean): boolean {
    return isPro || savedCount < FREE_SAVED_SPARKS_PER_TOOL;
}

/** Sparks a free user has left in a tool, for the "3 of 5 saved" counter. Never negative. */
export function remainingFreeSparks(savedCount: number): number {
    return Math.max(0, FREE_SAVED_SPARKS_PER_TOOL - savedCount);
}

/** The individual tools inside the practice suite (all gated under the "practice-suite" key). */
export type PracticeTool = "loop" | "pins" | "speed" | "pitch" | "analysis";

/**
 * Which practice tools are Pro. The whole suite is Pro today, but this is the SINGLE knob:
 * flip any entry to `false` to make that one tool free — every practice gate reads this map,
 * so no call site changes. (Keep the "practice-suite" entitlement key for all of them.)
 */
export const PRACTICE_TOOL_IS_PRO: Record<PracticeTool, boolean> = {
    loop: true,
    pins: true,
    speed: true,
    pitch: true,
    analysis: true,
};

export function isPracticeToolPro(tool: PracticeTool): boolean {
    return PRACTICE_TOOL_IS_PRO[tool];
}

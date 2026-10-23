/**
 * Pure gate-decision logic for the free/Pro split (Phase 6). Kept separate from
 * entitlements.ts (the reactive seam) and from React so the limits are unit-testable in
 * isolation: each function takes the current count + the caller's resolved `isPro`
 * (from hasProAccess / useHasProAccess) and returns a plain decision.
 *
 * The numbers and switches live in ONE place, domain/proCatalog.ts; these are thin
 * wrappers over it so a call site never carries its own constant.
 *
 * Invariant: these gate CREATING NEW Pro-tier content only. Opening, playing, or editing
 * content the user already has (existing multi-layer clips, already-saved sparks) is never
 * gated — callers must not run these checks on the read/edit paths.
 */

import { freeLimitOf, PRACTICE_TOOLS_PRO, PRO_CATALOG, withinFreeLimit, type PracticeTool } from "./proCatalog";

export type { PracticeTool } from "./proCatalog";

/** Overdub layers a free user may add per clip (proCatalog "overdub-layers".freeLimit). */
export const FREE_OVERDUB_LAYERS = freeLimitOf("overdub-layers") ?? Infinity;

/** Saved word-tool sparks a free user may keep PER TOOL (proCatalog "word-sparks-unlimited".freeLimit). */
export const FREE_SAVED_SPARKS_PER_TOOL = freeLimitOf("word-sparks-unlimited") ?? Infinity;

/** Workspaces a free user may have (proCatalog "workspaces".freeLimit). */
export const FREE_WORKSPACES = freeLimitOf("workspaces") ?? Infinity;

/** SongNook Send links a free user may make per 30 days (proCatalog "send".freeLimit). */
export const FREE_SEND_LINKS = freeLimitOf("send") ?? Infinity;

/** Parts a free user may cut a take into in one edit (proCatalog "full-editor".freeLimit). */
export const FREE_EDITOR_PARTS = freeLimitOf("full-editor") ?? Infinity;

/**
 * Whether the user may add another overdub layer. `existingLayerCount` is how many overdub
 * layers the clip already has (0 for a bare clip). Free users get FREE_OVERDUB_LAYERS.
 */
export function canAddOverdubLayer(existingLayerCount: number, isPro: boolean): boolean {
    return withinFreeLimit("overdub-layers", existingLayerCount, isPro);
}

/**
 * Whether the user may save another spark in a given tool. `savedCount` is how many sparks
 * are already saved IN THAT TOOL. Free users get FREE_SAVED_SPARKS_PER_TOOL.
 */
export function canSaveWordSpark(savedCount: number, isPro: boolean): boolean {
    return withinFreeLimit("word-sparks-unlimited", savedCount, isPro);
}

/** Sparks a free user has left in a tool, for the "3 of 5 saved" counter. Never negative. */
export function remainingFreeSparks(savedCount: number): number {
    return Math.max(0, FREE_SAVED_SPARKS_PER_TOOL - savedCount);
}

/**
 * Whether the user may create another workspace. `existingCount` is how many personal,
 * unarchived workspaces there are (the seeded one counts). Free users get FREE_WORKSPACES.
 */
export function canAddWorkspace(existingCount: number, isPro: boolean): boolean {
    return withinFreeLimit("workspaces", existingCount, isPro);
}

/**
 * Whether the user may add another part in the editor. `existingPartCount` is how many
 * parts the edit already has. A plain trim (one part) is free.
 */
export function canAddEditorPart(existingPartCount: number, isPro: boolean): boolean {
    return withinFreeLimit("full-editor", existingPartCount, isPro);
}

/**
 * Which practice tools are Pro: the "practice-suite" row AND the tool's own switch in
 * proCatalog PRACTICE_TOOLS_PRO. Every practice gate reads this, so no call site changes.
 */
export function isPracticeToolPro(tool: PracticeTool): boolean {
    return PRO_CATALOG["practice-suite"].pro && PRACTICE_TOOLS_PRO[tool];
}

/**
 * Whether the user may make another SongNook Send link. `recentCount` is how many links
 * this device made in the last 30 days. Receiving, and anything inside a received
 * parcel, is never counted or gated.
 */
export function canSendLink(recentCount: number, isPro: boolean): boolean {
    return withinFreeLimit("send", recentCount, isPro);
}

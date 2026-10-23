/**
 * THE free / Pro split, in one table. (Founder, 2026-10-22: "make sure I can choose and
 * adjust easily later what features are Pro gated.")
 *
 * Every gate in the app reads this table, so changing the split is a one-value edit here:
 *
 *   pro: true   → the feature is Pro once the paywall is live (ALL_FEATURES_FREE = false
 *                 in domain/entitlements.ts). Nothing here withholds anything while that
 *                 flag is true.
 *   pro: false  → free for everyone, whatever the paywall says. The call sites stay in
 *                 place, so flipping back later is the same one-value edit.
 *   freeLimit   → for count-based gates only: how many a free user gets before the gate
 *                 (layers per take, workspaces, saved sparks per tool, parts per edit).
 *   what        → a plain-English line of what the key covers. Used nowhere in the UI.
 *
 * Defaults are the founder-confirmed split of 2026-10-19 (docs/product-plan/
 * phase-6-monetization.md, founder block). The sweep's suggested tweaks sit as comments
 * next to the rows they would change. Never gate capture, backup, or opening existing
 * work: a gate stops CREATING new Pro-tier content, never reading what is there.
 *
 * After editing: `npx jest src/__tests__/proCatalog.test.ts` checks that the Pro sheet's
 * rows (PAYWALL_ROWS, below) still promise only what is gated.
 */

/** Every gate key in the app. Add a key here AND a row in PRO_CATALOG (tsc enforces it). */
export type ProFeature =
    | "workspaces"
    | "overdub-layers"
    | "full-editor"
    | "practice-suite"
    | "stage-tools"
    | "lyric-spark"
    | "word-sparks-unlimited"
    | "word-finder-full"
    | "send"
    | "pdf-export"
    | "archive-offload"
    | "auto-backup"
    | "cloud-backup";

export type ProCatalogRow = {
    /** Gated at all? false = free for everyone, even with the paywall live. */
    pro: boolean;
    /** Count-based gates: how many a free user gets before the gate. Omit for on/off gates. */
    freeLimit?: number;
    /** What the key covers, in plain English. Documentation only. */
    what: string;
};

export const PRO_CATALOG: Record<ProFeature, ProCatalogRow> = {
    // ── The library ──────────────────────────────────────────────────────────────────
    workspaces: {
        pro: true,
        freeLimit: 3, // Founder, 2026-10-23: "My Songs" plus two.
        what: "Creating a workspace beyond the free ones. Opening, renaming, archiving any workspace stays free.",
    },

    // ── Recording and the player ─────────────────────────────────────────────────────
    "overdub-layers": {
        pro: true,
        freeLimit: 1, // The first layer is the taste that sells the rest.
        what: "Adding a layer beyond the free ones on a take. Existing layered takes play and open as before.",
    },
    "practice-suite": {
        pro: true,
        what: "USING a practice tool: pins, pitch, analysis, Step up (per-tool switches in PRACTICE_TOOLS_PRO; a plain loop and speed are free). Opening practice mode and viewing existing marks stays free. A received parcel's clips practise free.",
    },

    // ── The editor ───────────────────────────────────────────────────────────────────
    "full-editor": {
        pro: true,
        freeLimit: 1, // One part (a plain trim) is free; a second part needs Pro.
        what: "The editor's Speed & pitch tab, and cutting a take into more than the free number of parts.",
    },

    // ── Charts and the stage ─────────────────────────────────────────────────────────
    "stage-tools": {
        pro: true,
        what: "Transpose, capo, creating a chart book or a setlist, opening the stage reader. Writing chord charts and reading existing charts, books and sets stay free; a received parcel's charts and books use these tools free.",
    },
    "pdf-export": {
        pro: true,
        what: "Exporting a chart as PDF. Text and archive exports stay free (export is never locked).",
    },

    // ── Lyrics ───────────────────────────────────────────────────────────────────────
    "lyric-spark": {
        pro: false, // Founder, 2026-10-23: the games are free; keeping many is Pro.
        what: "Starting a new spark (Word Ladder, Cut-Up, Magpie). Sparks already made stay open and editable.",
    },
    "word-sparks-unlimited": {
        pro: true,
        freeLimit: 3, // Saved sparks a free user keeps PER TOOL.
        what: "Saving more sparks per tool than the free number.",
    },
    "word-finder-full": {
        pro: true,
        what: "The whole Word Finder (founder, 2026-10-23: its lookups are third-party API calls we may come to pay for). Lyrics themselves stay free.",
    },

    // ── Sharing ──────────────────────────────────────────────────────────────────────
    send: {
        pro: true,
        freeLimit: 3, // Links a free user may make per 30 days (founder, 2026-10-23).
        what: "Getting a SongNook Send link beyond the free ones a month. Receiving through Send, and everything in a received parcel, is always free.",
    },

    // ── Storage ──────────────────────────────────────────────────────────────────────
    "archive-offload": {
        pro: true,
        what: "Offloading a workspace's archive to Files. A power-user storage feature, not backup.",
    },
    "auto-backup": {
        pro: false, // Backup is NEVER locked (founder). Key kept for the future automatic-backup feature.
        what: "Reserved for automatic backup. Nothing reads it today; the backup reminder is free.",
    },
    "cloud-backup": {
        pro: true,
        what: "Reserved for cloud sync. Nothing reads it today.",
    },
};

/** The individual tools inside the practice suite (all under the "practice-suite" key). */
export type PracticeTool = "loop" | "pins" | "speed" | "pitch" | "analysis" | "stepUp";

/**
 * Per-tool switches under "practice-suite": flip one to false to make that tool free
 * while the rest stay Pro. The whole row's `pro: false` frees them all.
 */
export const PRACTICE_TOOLS_PRO: Record<PracticeTool, boolean> = {
    loop: false, // A plain loop and the speed control are free (founder, 2026-10-23).
    pins: true,
    speed: false,
    pitch: true,
    analysis: true,
    stepUp: true,
};

/** Whether `key` is gated at all. A row with `pro: false` is free for everyone. */
export function isProFeature(key: ProFeature): boolean {
    return PRO_CATALOG[key].pro;
}

/** The free allowance of a count-based gate, or null when the key is on/off or free. */
export function freeLimitOf(key: ProFeature): number | null {
    const row = PRO_CATALOG[key];
    return row.pro && row.freeLimit != null ? row.freeLimit : null;
}

/**
 * Count-based decision: may a user with `existingCount` of a thing make one more?
 * `isPro` is the caller's resolved entitlement (hasProAccess / useHasProAccess).
 */
export function withinFreeLimit(key: ProFeature, existingCount: number, isPro: boolean): boolean {
    const limit = freeLimitOf(key);
    return isPro || limit == null || existingCount < limit;
}

/**
 * The Pro sheet's feature rows, in order: each row's copy lives at
 * `pro.features.<index>` in i18n/translations.ts and promises the keys listed here.
 * The test (proCatalog.test.ts) fails when a row promises a key that is no longer
 * gated, so flipping a row above means editing the sheet's copy too.
 */
export const PAYWALL_ROWS: ReadonlyArray<{ icon: string; features: ProFeature[] }> = [
    { icon: "musical-notes-outline", features: ["stage-tools"] },
    { icon: "layers-outline", features: ["overdub-layers"] },
    { icon: "repeat-outline", features: ["practice-suite"] },
    { icon: "cut-outline", features: ["full-editor"] },
    { icon: "sparkles-outline", features: ["word-finder-full", "word-sparks-unlimited"] },
    { icon: "paper-plane-outline", features: ["send", "workspaces"] },
];

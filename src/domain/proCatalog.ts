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
 * After editing: `npx jest src/__tests__/proCatalog.test.ts` checks that the Pro page's
 * lines (PAYWALL_ROWS, below) still promise only what is gated.
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
    | "daw-export"
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
        freeLimit: 2, // Founder, 2026-11-14: solo work plus one band (was 3, "My Songs" plus two).
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
        what: "USING a practice tool: speed, pitch, Step up (per-tool switches in PRACTICE_TOOLS_PRO; a plain loop and pins are free, and going back toward the original speed or key always is: domain/proGating.ts `isTowardOriginal`). Tempo detection sits under the same key but its door is hidden for everyone, so it is not named on any list of Pro tools. Opening practice mode and viewing existing marks stays free. A received parcel's clips practise free.",
    },

    // ── The editor ───────────────────────────────────────────────────────────────────
    "full-editor": {
        pro: true,
        // No freeLimit (founder, 2026-11-13: "Trimming to edit should not be pay walled"):
        // cutting a take into any number of parts is free. Put `freeLimit: n` back to
        // gate parts beyond n; the call site (useEditorSelectionState) is still in place.
        what: "The editor's Speed & pitch tab. Trimming, and cutting a take into any number of parts, stays free.",
    },

    // ── Charts and the stage ─────────────────────────────────────────────────────────
    "stage-tools": {
        pro: true,
        what: "Transpose, capo, creating a chart book or a setlist. Writing chord charts and reading existing charts, books (in the stage reader too, 11-M3) and sets stay free; a received parcel's charts and books use these tools free.",
    },
    "pdf-export": {
        pro: true,
        what: "Exporting a chart as PDF. Text, ChordPro and SongNook-file exports stay free: your work always leaves the app.",
    },
    "daw-export": {
        pro: true, // Founder, 2026-11-14: a finishing tool; sharing the audio as recorded stays free.
        what: "Export for DAW: a bar-aligned WAV named with its tempo. Sharing the take's own audio stays free.",
    },

    // ── Lyrics ───────────────────────────────────────────────────────────────────────
    "lyric-spark": {
        pro: true,
        freeLimit: 1, // Founder, 2026-11-14: one try of each game, three in all (was three of each).
        what: "Starting a spark (Word Ladder, Cut-Up, Magpie) beyond the free try of that game. Tries are counted for good (services/sparkTries.ts): deleting a spark gives none back; a spark left with nothing written gives its try back; sparks started with Pro or in the free month don't count. Sparks already made stay open and editable.",
    },
    "word-sparks-unlimited": {
        pro: false, // Retired 2026-10-25: the limit is on starting a spark (lyric-spark), not on keeping one.
        what: "Formerly the cap on saved sparks per tool. Nothing reads it; kept so old references type-check.",
    },
    "word-finder-full": {
        pro: true,
        what: "The whole Word Finder (founder, 2026-10-23: its lookups are third-party API calls we may come to pay for). Lyrics themselves stay free.",
    },

    // ── Sharing ──────────────────────────────────────────────────────────────────────
    send: {
        pro: true,
        freeLimit: 1, // Links a free user may make per 30 days (founder, 2026-11-14; was 3). The Send server holds the same number (server/songnook-send/src/lib/access.ts FREE_LINKS).
        what: "Getting a SongNook Send link beyond the free ones a month. Receiving through Send, and everything in a received parcel, is always free.",
    },

    // ── Storage ──────────────────────────────────────────────────────────────────────
    "archive-offload": {
        pro: true,
        what: "Offloading a workspace's archive to Files. A power-user storage feature, not backup. Archiving is shelved (2026-08-04), so nobody new can reach this; it is on no list of Pro tools until archiving returns (founder, 2026-11-14).",
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
    loop: false, // A plain loop is free: looping a part while you write is writing (founder, 2026-10-23).
    pins: false, // Founder, 2026-11-14: marking your own take is tidying; the recorder's pins were always free.
    speed: true, // Founder, 2026-11-14: the practice tool people use most (was free).
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
 * The Pro page's feature lines, in order: each line's copy lives at
 * `pro.features.<index>` in the locale files (a `title`, the result, and a `body`, the
 * tool) and promises the keys listed here. The test (proCatalog.test.ts) fails when a
 * line promises a key that is no longer gated, so flipping a row above means editing
 * the page's copy too. Five lines, most useful first (founder, 2026-11-14: "harmony
 * layers are not the most useful in my book"): writing, practice, the stage, sharing,
 * then layers. Ranked by how often a songwriter reaches for each, by judgement.
 */
export const PAYWALL_ROWS: ReadonlyArray<{ icon: string; features: ProFeature[] }> = [
    { icon: "sparkles-outline", features: ["lyric-spark", "word-finder-full"] },
    { icon: "repeat-outline", features: ["practice-suite", "full-editor"] },
    { icon: "musical-notes-outline", features: ["stage-tools", "pdf-export"] },
    { icon: "paper-plane-outline", features: ["send"] },
    { icon: "layers-outline", features: ["overdub-layers"] },
];

/** The page's one quiet closing line (`pro.also`): Pro doors that are not a line of their own. */
export const PAYWALL_ALSO: ReadonlyArray<ProFeature> = ["workspaces", "daw-export"];

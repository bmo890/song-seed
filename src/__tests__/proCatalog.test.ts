import { resources } from "../i18n/translations";
import {
    PAYWALL_ROWS,
    PRACTICE_TOOLS_PRO,
    PRO_CATALOG,
    freeLimitOf,
    isProFeature,
    withinFreeLimit,
    type ProFeature,
} from "../domain/proCatalog";
import { hasProAccess } from "../domain/entitlements";
import {
    FREE_OVERDUB_LAYERS,
    FREE_SPARK_TRIES_PER_GAME,
    FREE_WORKSPACES,
    canAddEditorPart,
    canAddWorkspace,
    canSendLink,
    FREE_SEND_LINKS,
    isPracticeToolPro,
    isTowardOriginal,
} from "../domain/proGating";

/** Every key the app gates with. Adding a key to the union without a row fails tsc; this
 *  keeps the runtime table honest too (and documents the keys in one place). */
const EVERY_KEY: ProFeature[] = [
    "workspaces",
    "overdub-layers",
    "full-editor",
    "practice-suite",
    "stage-tools",
    "lyric-spark",
    "word-sparks-unlimited",
    "word-finder-full",
    "send",
    "pdf-export",
    "daw-export",
    "archive-offload",
    "auto-backup",
    "cloud-backup",
];

describe("the Pro catalog", () => {
    it("has one row per feature key, each with a plain-English line", () => {
        expect(Object.keys(PRO_CATALOG).sort()).toEqual([...EVERY_KEY].sort());
        for (const key of EVERY_KEY) {
            const row = PRO_CATALOG[key];
            expect(typeof row.pro).toBe("boolean");
            expect(row.what.trim().length).toBeGreaterThan(0);
            if (row.freeLimit != null) {
                expect(Number.isInteger(row.freeLimit)).toBe(true);
                expect(row.freeLimit).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it("never locks backup (founder: backup is free)", () => {
        expect(isProFeature("auto-backup")).toBe(false);
        expect(hasProAccess("auto-backup")).toBe(true);
    });

    it("reads limits only from gated rows", () => {
        expect(freeLimitOf("overdub-layers")).toBe(PRO_CATALOG["overdub-layers"].freeLimit);
        expect(freeLimitOf("stage-tools")).toBeNull(); // on/off gate
        expect(freeLimitOf("auto-backup")).toBeNull(); // free: no limit applies
        expect(withinFreeLimit("overdub-layers", 0, false)).toBe(true);
        expect(withinFreeLimit("overdub-layers", FREE_OVERDUB_LAYERS, false)).toBe(false);
        expect(withinFreeLimit("overdub-layers", 99, true)).toBe(true);
        expect(withinFreeLimit("stage-tools", 99, false)).toBe(true); // a limit-less key never counts
    });

    it("drives the proGating helpers", () => {
        expect(FREE_OVERDUB_LAYERS).toBe(PRO_CATALOG["overdub-layers"].freeLimit);
        expect(FREE_SPARK_TRIES_PER_GAME).toBe(PRO_CATALOG["lyric-spark"].freeLimit);
        expect(FREE_WORKSPACES).toBe(PRO_CATALOG.workspaces.freeLimit);
        expect(canAddWorkspace(FREE_WORKSPACES - 1, false)).toBe(true);
        expect(canAddWorkspace(FREE_WORKSPACES, false)).toBe(false);
        expect(canAddWorkspace(FREE_WORKSPACES, true)).toBe(true);
        // Cutting into parts is free (founder, 2026-11-13); Speed & pitch stays gated.
        expect(freeLimitOf("full-editor")).toBeNull();
        expect(isProFeature("full-editor")).toBe(true);
        expect(canAddEditorPart(0, false)).toBe(true);
        expect(canAddEditorPart(12, false)).toBe(true);
        expect(canAddEditorPart(5, true)).toBe(true);
        expect(FREE_SEND_LINKS).toBe(PRO_CATALOG.send.freeLimit);
        expect(canSendLink(FREE_SEND_LINKS - 1, false)).toBe(true);
        expect(canSendLink(FREE_SEND_LINKS, false)).toBe(false);
        expect(canSendLink(99, true)).toBe(true);
        for (const tool of Object.keys(PRACTICE_TOOLS_PRO) as (keyof typeof PRACTICE_TOOLS_PRO)[]) {
            expect(isPracticeToolPro(tool)).toBe(PRO_CATALOG["practice-suite"].pro && PRACTICE_TOOLS_PRO[tool]);
        }
    });
});

describe("the Pro page's lines", () => {
    const rowCount = (lang: "en" | "he") =>
        Object.keys((resources[lang].translation as { pro: { features: Record<string, unknown> } }).pro.features).length;

    it("match the translated feature lines one to one", () => {
        expect(rowCount("en")).toBe(PAYWALL_ROWS.length);
        expect(rowCount("he")).toBe(PAYWALL_ROWS.length);
    });

    it("promise only what is actually gated (flip a row's gate → edit the page's copy)", () => {
        for (const row of PAYWALL_ROWS) {
            expect(row.features.length).toBeGreaterThan(0);
            for (const feature of row.features) {
                expect({ feature, pro: isProFeature(feature) }).toEqual({ feature, pro: true });
            }
        }
    });

    it("advertise every gated feature with a call site, apart from the quiet storage ones", () => {
        const advertised = new Set(PAYWALL_ROWS.flatMap((row) => row.features));
        // Storage and the keys reserved for future features are Pro without a line on the page.
        const quiet: ProFeature[] = ["archive-offload", "cloud-backup", "pdf-export"];
        for (const key of EVERY_KEY) {
            if (!isProFeature(key) || quiet.includes(key)) continue;
            expect({ key, advertised: advertised.has(key) }).toEqual({ key, advertised: true });
        }
    });
});

describe("the founder's split (2026-11-14, after the feature audit)", () => {
    it("keeps capture, marking and looping free; the most-used tool of each Pro group is Pro", () => {
        expect(isPracticeToolPro("loop")).toBe(false);
        expect(isPracticeToolPro("pins")).toBe(false);
        expect(isPracticeToolPro("speed")).toBe(true);
        expect(isPracticeToolPro("pitch")).toBe(true);
        expect(isPracticeToolPro("stepUp")).toBe(true);
        expect(isProFeature("lyric-spark")).toBe(true);
        expect(isProFeature("word-finder-full")).toBe(true);
        expect(isProFeature("daw-export")).toBe(true);
        expect(FREE_WORKSPACES).toBe(2);
        expect(FREE_SPARK_TRIES_PER_GAME).toBe(1);
        expect(FREE_SEND_LINKS).toBe(1);
    });

    it("never gates a step back toward the original", () => {
        expect(isTowardOriginal(3, 2)).toBe(true); // capo 3 → 2
        expect(isTowardOriginal(-2, -1)).toBe(true); // transposed down, stepping up
        expect(isTowardOriginal(2, 0)).toBe(true);
        expect(isTowardOriginal(0, 1)).toBe(false);
        expect(isTowardOriginal(2, 3)).toBe(false);
        expect(isTowardOriginal(2, -2)).toBe(false); // through the original and out the far side
        expect(isTowardOriginal(0.75, 1, 1)).toBe(true); // speed back to 1×
        expect(isTowardOriginal(0.75, 0.5, 1)).toBe(false);
        expect(isTowardOriginal(1, 1, 1)).toBe(false);
    });
});

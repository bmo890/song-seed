jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collectSatelliteSnapshot,
    mergeSatelliteState,
    sanitizeSatelliteSnapshot,
    writeSatelliteSnapshot,
} from "../satelliteSnapshot";
import { useShelfStore } from "../../state/useShelfStore";
import { useChartPrefsStore } from "../../state/useChartPrefsStore";
import { useSentLinksStore } from "../../state/useSentLinksStore";

/**
 * The satellite block carries the small AsyncStorage stores through the exact backup. The
 * store's own persist key + version are what get written, so a later boot hydrates through
 * the store's normal `merge` sanitizer.
 */

beforeEach(async () => {
    await AsyncStorage.clear();
    useShelfStore.setState({ entries: [], departed: [] });
    useChartPrefsStore.setState({ transposeByIdeaId: {}, capoByIdeaId: {}, readingZoom: 1, chordsHidden: false });
    useSentLinksStore.setState({ links: [] });
});

describe("collectSatelliteSnapshot", () => {
    it("snapshots each store's persisted slice under its persist key and version, plus the language", async () => {
        useShelfStore.getState().setAside([{ kind: "idea", id: "idea-1" }], 1000);
        useChartPrefsStore.getState().setTranspose("idea-1", 2);
        await AsyncStorage.setItem("songnook-ui-language-v1", "he");

        const snapshot = await collectSatelliteSnapshot();

        expect(snapshot.schemaVersion).toBe(1);
        expect(snapshot.uiLanguage).toBe("he");
        expect(snapshot.stores.shelf).toMatchObject({ name: "songnook-shelf-store", version: 1 });
        expect((snapshot.stores.shelf!.state.entries as unknown[]).length).toBe(1);
        expect(snapshot.stores.chartPrefs!.state).toEqual({
            transposeByIdeaId: { "idea-1": 2 },
            capoByIdeaId: {},
            readingZoom: 1,
            chordsHidden: false,
            playAlongWithCapo: true,
        });
        // Persisted slice only — no functions leak into the backup.
        expect(Object.values(snapshot.stores.shelf!.state).some((v) => typeof v === "function")).toBe(false);
    });
});

describe("small preference stores (audit G11)", () => {
    it("carries practice, layer, Compilations, sender-name and spark-zoom prefs through a backup", async () => {
        const { usePracticePrefsStore } = require("../../state/usePracticePrefsStore");
        const { useLayerPrefsStore } = require("../../state/useLayerPrefsStore");
        const { useReceivedPrefsStore } = require("../../state/useReceivedPrefsStore");
        const { useSendPrefsStore } = require("../../state/useSendPrefsStore");
        const { useSparkPrefsStore } = require("../../state/useSparkPrefsStore");
        useLayerPrefsStore.setState({ lanesCollapsed: true, collapsedLayerIds: ["l1"] });
        useSendPrefsStore.setState({ senderName: "Ben" });
        useReceivedPrefsStore.setState({ compilationFilter: "mine", compilationSort: "updated" });

        const snapshot = await collectSatelliteSnapshot();

        expect(snapshot.stores).toHaveProperty("practicePrefs.name", usePracticePrefsStore.persist.getOptions().name);
        expect(snapshot.stores).toHaveProperty("layerPrefs.state", { lanesCollapsed: true, collapsedLayerIds: ["l1"] });
        expect(snapshot.stores).toHaveProperty("receivedPrefs.state.compilationFilter", "mine");
        expect(snapshot.stores).toHaveProperty("sendPrefs.state", { senderName: "Ben" });
        expect(snapshot.stores).toHaveProperty("sparkPrefs.name", useSparkPrefsStore.persist.getOptions().name);

        // And they come back under their own keys on a restore.
        const roundTrip = sanitizeSatelliteSnapshot(JSON.parse(JSON.stringify(snapshot)))!;
        const result = await writeSatelliteSnapshot(roundTrip, "replace");
        expect(result.written).toEqual(
            expect.arrayContaining(["practicePrefs", "layerPrefs", "receivedPrefs", "sendPrefs", "sparkPrefs"])
        );
        expect(JSON.parse((await AsyncStorage.getItem("songnook-send-prefs"))!).state).toEqual({ senderName: "Ben" });
    });

    it("merge keeps the phone's own preference", () => {
        expect(mergeSatelliteState("sendPrefs" as never, { senderName: "Old" }, { senderName: "New" })).toEqual({
            senderName: "New",
        });
    });
});

describe("sanitizeSatelliteSnapshot", () => {
    it("accepts the block it wrote and rejects anything else", () => {
        expect(sanitizeSatelliteSnapshot(undefined)).toBeUndefined();
        expect(sanitizeSatelliteSnapshot({ schemaVersion: 2, stores: {} })).toBeUndefined();
        expect(sanitizeSatelliteSnapshot({ schemaVersion: 1, stores: "nope" })).toBeUndefined();
        const cleaned = sanitizeSatelliteSnapshot({
            schemaVersion: 1,
            uiLanguage: "fr",
            stores: {
                shelf: { name: "songnook-shelf-store", version: 1, state: { entries: [] } },
                chartPrefs: { name: 5, version: 1, state: {} },
                bogus: { name: "x", version: 1, state: {} },
            },
        });
        expect(cleaned).toEqual({
            schemaVersion: 1,
            stores: { shelf: { name: "songnook-shelf-store", version: 1, state: { entries: [] } } },
        });
    });
});

describe("writeSatelliteSnapshot", () => {
    it("replace mode writes each store's raw state under its own key with the current version, and the language", async () => {
        const result = await writeSatelliteSnapshot(
            {
                schemaVersion: 1,
                uiLanguage: "he",
                stores: {
                    chartPrefs: { name: "songnook-chart-prefs", version: 1, state: { transposeByIdeaId: { a: -1 } } },
                    shelf: { name: "renamed-elsewhere", version: 1, state: { entries: [] } },
                },
            },
            "replace"
        );
        expect(result.written).toEqual(["chartPrefs"]);
        expect(result.skipped).toEqual(["shelf"]);
        // A backup from before capo (store v1) lands under today's version; the
        // store's merge fills what it lacks.
        expect(JSON.parse((await AsyncStorage.getItem("songnook-chart-prefs"))!)).toEqual({
            state: { transposeByIdeaId: { a: -1 } },
            version: 2,
        });
        expect(await AsyncStorage.getItem("songnook-ui-language-v1")).toBe("he");
    });

    it("merge mode keeps the current phone's values and brings back backup-only ones, leaving the language alone", async () => {
        useChartPrefsStore.getState().setTranspose("shared", 3);
        useShelfStore.getState().setAside([{ kind: "idea", id: "current" }], 1000);
        await AsyncStorage.setItem("songnook-ui-language-v1", "en");

        await writeSatelliteSnapshot(
            {
                schemaVersion: 1,
                uiLanguage: "he",
                stores: {
                    chartPrefs: { name: "songnook-chart-prefs", version: 1, state: { transposeByIdeaId: { shared: -5, old: 1 } } },
                    shelf: {
                        name: "songnook-shelf-store",
                        version: 1,
                        state: {
                            entries: [
                                { kind: "idea", id: "current", key: "idea:current", shelvedAt: 1, expiresAt: 2, keepCount: 9 },
                                { kind: "idea", id: "lost", key: "idea:lost", shelvedAt: 1, expiresAt: 2, keepCount: 0 },
                            ],
                            departed: [],
                        },
                    },
                },
            },
            "merge"
        );

        const chart = JSON.parse((await AsyncStorage.getItem("songnook-chart-prefs"))!);
        expect(chart.state.transposeByIdeaId).toEqual({ shared: 3, old: 1 });
        const shelf = JSON.parse((await AsyncStorage.getItem("songnook-shelf-store"))!);
        const entries = shelf.state.entries as Array<{ key: string; keepCount: number }>;
        expect(entries.map((e) => e.key).sort()).toEqual(["idea:current", "idea:lost"]);
        expect(entries.find((e) => e.key === "idea:current")!.keepCount).toBe(0);
        expect(await AsyncStorage.getItem("songnook-ui-language-v1")).toBe("en");
    });
});

describe("mergeSatelliteState", () => {
    it("unions sent links by transfer id with the current copy winning", () => {
        const merged = mergeSatelliteState(
            "sentLinks",
            { links: [{ transferId: "t1", title: "old" }, { transferId: "t2", title: "lost" }] },
            { links: [{ transferId: "t1", title: "new" }] }
        );
        expect(merged.links).toEqual([{ transferId: "t1", title: "new" }, { transferId: "t2", title: "lost" }]);
    });

    it("unions revisit filters and keeps the current daily-refresh choice", () => {
        const merged = mergeSatelliteState(
            "revisit",
            { excludedWorkspaceIds: ["a"], snoozedUntilById: { x: 1 }, dailyRefresh: true },
            { excludedWorkspaceIds: ["b"], snoozedUntilById: { x: 2, y: 3 }, dailyRefresh: false }
        );
        expect(merged.excludedWorkspaceIds).toEqual(["b", "a"]);
        expect(merged.snoozedUntilById).toEqual({ x: 2, y: 3 });
        expect(merged.dailyRefresh).toBe(false);
    });
});

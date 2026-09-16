import AsyncStorage from "@react-native-async-storage/async-storage";
import { UI_LANGUAGE_STORAGE_KEY, type AppLanguage } from "../i18n/locale";
import { useActivityStore } from "../state/useActivityStore";
import { useChartPrefsStore } from "../state/useChartPrefsStore";
import { useMagpiePrefsStore } from "../state/useMagpiePrefsStore";
import { useRevisitStore } from "../state/useRevisitStore";
import { useSentLinksStore } from "../state/useSentLinksStore";
import { useShelfStore } from "../state/useShelfStore";
import { useStepUpPresetsStore } from "../state/useStepUpPresetsStore";

/**
 * The library store is not the only thing a musician would miss on a new phone. Seven
 * small zustand stores persist on their own in AsyncStorage — the Shelf (set-aside ideas
 * and their stays), chart transposition per song, Revisit/Activity source filters, sent
 * share links, Step-Up drill plans, Magpie library prefs — plus the chosen UI language.
 * None of them used to reach the exact backup, so a restore silently emptied the Shelf
 * and reset every transposition.
 *
 * This module snapshots them into the backup (`satellites` block inside snapshot.json)
 * and writes them back on restore. Each store is written under ITS OWN persist key with
 * ITS CURRENT version, so the store's own `merge` sanitizer validates the restored shape
 * on the next hydration — the same path a normal boot takes. Older apps ignore the block.
 */

type SatellitePersistStore = {
    getState: () => unknown;
    persist: {
        getOptions: () => {
            name?: string;
            version?: number;
            partialize?: (state: never) => unknown;
        };
    };
};

const SATELLITE_STORES = {
    shelf: useShelfStore,
    chartPrefs: useChartPrefsStore,
    revisit: useRevisitStore,
    activity: useActivityStore,
    sentLinks: useSentLinksStore,
    stepUpPresets: useStepUpPresetsStore,
    magpiePrefs: useMagpiePrefsStore,
} as const satisfies Record<string, SatellitePersistStore>;

export type SatelliteStoreKey = keyof typeof SATELLITE_STORES;
export const SATELLITE_STORE_KEYS = Object.keys(SATELLITE_STORES) as SatelliteStoreKey[];

export type DrSatelliteRecord = {
    /** The store's persist key at backup time — must match on restore or the record is skipped. */
    name: string;
    version: number;
    state: Record<string, unknown>;
};

export type DrSatelliteSnapshot = {
    schemaVersion: 1;
    stores: Partial<Record<SatelliteStoreKey, DrSatelliteRecord>>;
    uiLanguage?: AppLanguage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function persistedStateOf(store: SatellitePersistStore): Record<string, unknown> {
    const options = store.persist.getOptions();
    const state = store.getState();
    const partial = options.partialize ? options.partialize(state as never) : state;
    return isRecord(partial) ? partial : {};
}

/** Snapshot every satellite store as it is persisted (partialized), plus the UI language. */
export async function collectSatelliteSnapshot(): Promise<DrSatelliteSnapshot> {
    const stores: DrSatelliteSnapshot["stores"] = {};
    for (const key of SATELLITE_STORE_KEYS) {
        const store = SATELLITE_STORES[key] as SatellitePersistStore;
        const options = store.persist.getOptions();
        if (!options.name) continue;
        stores[key] = {
            name: options.name,
            version: options.version ?? 0,
            state: persistedStateOf(store),
        };
    }
    let uiLanguage: AppLanguage | undefined;
    try {
        const stored = await AsyncStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
        if (stored === "en" || stored === "he") uiLanguage = stored;
    } catch {
        // Language is a nicety; a backup must never fail over it.
    }
    return { schemaVersion: 1, stores, ...(uiLanguage ? { uiLanguage } : null) };
}

/** Accept the block only when it has the shape we wrote; anything else is ignored. */
export function sanitizeSatelliteSnapshot(value: unknown): DrSatelliteSnapshot | undefined {
    if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.stores)) return undefined;
    const stores: DrSatelliteSnapshot["stores"] = {};
    for (const key of SATELLITE_STORE_KEYS) {
        const record = value.stores[key];
        if (!isRecord(record)) continue;
        if (typeof record.name !== "string" || !Number.isFinite(record.version) || !isRecord(record.state)) continue;
        stores[key] = { name: record.name, version: Number(record.version), state: record.state };
    }
    const uiLanguage = value.uiLanguage === "en" || value.uiLanguage === "he" ? value.uiLanguage : undefined;
    return { schemaVersion: 1, stores, ...(uiLanguage ? { uiLanguage } : null) };
}

// ── Merge ("keep newer items") ───────────────────────────────────────────────

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function unionStrings(current: unknown, restored: unknown): string[] {
    return Array.from(new Set([...stringArray(current), ...stringArray(restored)]));
}

function unionRecords(current: unknown, restored: unknown): Record<string, unknown> {
    return { ...(isRecord(restored) ? restored : {}), ...(isRecord(current) ? current : {}) };
}

/** Current entries first (they win collisions), then restored-only entries by `keyOf`. */
function unionByKey(current: unknown, restored: unknown, keyOf: (item: Record<string, unknown>) => string | undefined) {
    const currentItems = Array.isArray(current) ? current.filter(isRecord) : [];
    const restoredItems = Array.isArray(restored) ? restored.filter(isRecord) : [];
    const seen = new Set(currentItems.map(keyOf).filter((key): key is string => !!key));
    const extra = restoredItems.filter((item) => {
        const key = keyOf(item);
        return !!key && !seen.has(key);
    });
    return extra.length === 0 ? currentItems : [...currentItems, ...extra];
}

/**
 * Same rule as the library merge: the current phone's state wins every collision, and
 * anything that exists only in the backup comes back.
 */
export function mergeSatelliteState(
    key: SatelliteStoreKey,
    restored: Record<string, unknown>,
    current: Record<string, unknown>
): Record<string, unknown> {
    switch (key) {
        case "shelf":
            return {
                ...current,
                entries: unionByKey(current.entries, restored.entries, (item) =>
                    typeof item.key === "string" ? item.key : undefined
                ),
                departed: unionByKey(current.departed, restored.departed, (item) =>
                    typeof item.key === "string" ? item.key : undefined
                ),
            };
        case "chartPrefs":
            return { ...current, transposeByIdeaId: unionRecords(current.transposeByIdeaId, restored.transposeByIdeaId) };
        case "revisit":
            return {
                ...current,
                excludedWorkspaceIds: unionStrings(current.excludedWorkspaceIds, restored.excludedWorkspaceIds),
                excludedCollectionIds: unionStrings(current.excludedCollectionIds, restored.excludedCollectionIds),
                hiddenCandidateIds: unionStrings(current.hiddenCandidateIds, restored.hiddenCandidateIds),
                snoozedUntilById: unionRecords(current.snoozedUntilById, restored.snoozedUntilById),
                vaultExposureCountById: unionRecords(current.vaultExposureCountById, restored.vaultExposureCountById),
                vaultLastSeenAtById: unionRecords(current.vaultLastSeenAtById, restored.vaultLastSeenAtById),
                vaultLastSessionKeyById: unionRecords(current.vaultLastSessionKeyById, restored.vaultLastSessionKeyById),
                tagPrefs: unionRecords(current.tagPrefs, restored.tagPrefs),
            };
        case "activity":
            return {
                ...current,
                excludedWorkspaceIds: unionStrings(current.excludedWorkspaceIds, restored.excludedWorkspaceIds),
                excludedCollectionIds: unionStrings(current.excludedCollectionIds, restored.excludedCollectionIds),
            };
        case "sentLinks":
            return {
                ...current,
                links: unionByKey(current.links, restored.links, (item) =>
                    typeof item.transferId === "string" ? item.transferId : undefined
                ),
            };
        case "stepUpPresets":
            return {
                ...current,
                activePlan: current.activePlan ?? restored.activePlan ?? null,
                customPlan: current.customPlan ?? restored.customPlan ?? null,
                userPresets: unionByKey(current.userPresets, restored.userPresets, (item) =>
                    typeof item.id === "string" ? item.id : undefined
                ),
            };
        case "magpiePrefs":
            return { ...current };
    }
}

export type WriteSatelliteSnapshotResult = { written: SatelliteStoreKey[]; skipped: SatelliteStoreKey[] };

/**
 * Write the restored satellite state straight into AsyncStorage under each store's persist
 * key, with the store's CURRENT version so its `merge` sanitizer runs on the next boot.
 * Called after the library snapshot is committed, before the restart. A record whose
 * persist key no longer matches (renamed store) is skipped rather than written blindly.
 */
export async function writeSatelliteSnapshot(
    snapshot: DrSatelliteSnapshot,
    mode: "replace" | "merge"
): Promise<WriteSatelliteSnapshotResult> {
    const pairs: [string, string][] = [];
    const written: SatelliteStoreKey[] = [];
    const skipped: SatelliteStoreKey[] = [];
    for (const key of SATELLITE_STORE_KEYS) {
        const record = snapshot.stores[key];
        if (!record) continue;
        const store = SATELLITE_STORES[key] as SatellitePersistStore;
        const options = store.persist.getOptions();
        if (!options.name || options.name !== record.name) {
            skipped.push(key);
            continue;
        }
        const state =
            mode === "merge" ? mergeSatelliteState(key, record.state, persistedStateOf(store)) : record.state;
        pairs.push([options.name, JSON.stringify({ state, version: options.version ?? 0 })]);
        written.push(key);
    }
    if (mode === "replace" && snapshot.uiLanguage) {
        pairs.push([UI_LANGUAGE_STORAGE_KEY, snapshot.uiLanguage]);
    }
    if (pairs.length > 0) {
        await AsyncStorage.multiSet(pairs);
    }
    return { written, skipped };
}

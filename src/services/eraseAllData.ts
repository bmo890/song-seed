import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { reloadAppAsync } from "expo";
import { useStore } from "../state/useStore";
import { useActivityStore } from "../state/useActivityStore";
import { useChartPrefsStore } from "../state/useChartPrefsStore";
import { useMagpiePrefsStore } from "../state/useMagpiePrefsStore";
import { useRevisitStore } from "../state/useRevisitStore";
import { useSentLinksStore } from "../state/useSentLinksStore";
import { useShelfStore } from "../state/useShelfStore";
import { useStepUpPresetsStore } from "../state/useStepUpPresetsStore";
import { clearPersistBlockedSignal, setPersistBlocked } from "../state/persistRuntime";
import { deleteDatabaseFiles } from "../state/db/database";
import { waitForWriteQueueIdle } from "../state/db/storage";
import { STORE_NAME } from "../state/persistedSnapshot";
import { stopManifestSync } from "./manifestSync";
import { SONG_NOOK_ROOT } from "./storagePaths";

/**
 * Fresh slate: remove every byte SongNook has written to this device, then reload into
 * a first launch. Founder request (2026-09-07). Each step is best-effort — one failure
 * must not leave the rest of the data behind — and the order matters:
 *
 * 1. freeze writers (persist, manifest mirror), so nothing re-materialises mid-wipe;
 * 2. clear the persisted stores through their own adapters, then AsyncStorage wholesale —
 *    AWAITING the library store's row sweep (zustand's `persist.clearStorage()` fires it
 *    and returns nothing) and draining the SQLite write queue, because a statement that
 *    reaches the connection after step 3 closes it is a native segfault, not an error;
 * 3. close and delete the SQLite database;
 * 4. delete every directory the app owns (audio, trash, manifest, archives, caches);
 * 5. reload the JS app — the store re-hydrates empty and the welcome flow runs.
 *
 * Storage inventory kept in step with docs/product-plan/store-privacy-answers.md.
 */

export type EraseStep =
    | "freeze"
    | "stores"
    | "asyncStorage"
    | "database"
    | "files"
    | "reload";

export type EraseAllDataResult = { failures: { step: EraseStep; error: string }[] };

const documentDir = () => FileSystem.documentDirectory ?? "";
const cacheDir = () => FileSystem.cacheDirectory ?? "";

/** Every location the app writes to — document dir, cache dir, and the SQLite folder. */
export function eraseTargets(): string[] {
    return [
        SONG_NOOK_ROOT,
        `${documentDir()}diagnostics`,
        `${documentDir()}dev-samples`,
        `${documentDir()}SQLite`,
        `${cacheDir()}songnook-receive`,
        `${cacheDir()}songnook`,
    ].filter((uri) => uri.length > 0 && uri !== documentDir() && uri !== cacheDir());
}

/** Satellite stores (AsyncStorage-backed). The library store is swept separately. */
const SATELLITE_STORES = () => [
    useActivityStore,
    useChartPrefsStore,
    useMagpiePrefsStore,
    useRevisitStore,
    useSentLinksStore,
    useShelfStore,
    useStepUpPresetsStore,
];

async function attempt(
    step: EraseStep,
    failures: EraseAllDataResult["failures"],
    run: () => Promise<void> | void
) {
    try {
        await run();
    } catch (error) {
        failures.push({ step, error: error instanceof Error ? error.message : String(error) });
    }
}

export async function eraseAllAppData(options?: { reload?: boolean }): Promise<EraseAllDataResult> {
    const failures: EraseAllDataResult["failures"] = [];

    await attempt("freeze", failures, () => {
        const store = useStore.getState();
        store.clearPlayerQueue();
        store.clearRecordingContext();
        stopManifestSync();
        // Nothing derived from the soon-to-be-empty memory may land anywhere.
        setPersistBlocked(true);
        clearPersistBlockedSignal();
    });

    await attempt("stores", failures, async () => {
        // The sharded adapter's removeItem sweeps meta + workspace + quarantine rows and
        // returns the promise; go through it directly so the sweep can be awaited.
        await useStore.persist.getOptions().storage?.removeItem(STORE_NAME);
        for (const store of SATELLITE_STORES()) {
            store.persist.clearStorage();
        }
        await waitForWriteQueueIdle();
    });

    await attempt("asyncStorage", failures, async () => {
        // App-sandboxed: covers the standalone keys (language, pending recording, clipboard
        // check), the fallback mirror rows, and anything a satellite store left behind.
        await AsyncStorage.clear();
    });

    await attempt("database", failures, async () => {
        await waitForWriteQueueIdle();
        await deleteDatabaseFiles();
    });

    await attempt("files", failures, async () => {
        for (const uri of eraseTargets()) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
        }
    });

    if (options?.reload !== false) {
        await attempt("reload", failures, async () => {
            await reloadAppAsync("erase-all-data");
        });
    }

    return { failures };
}

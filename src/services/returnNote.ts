import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import * as FileSystem from "expo-file-system/legacy";
import {
    mergeReturnNote,
    parseReturnNote,
    type ReturnNote,
    type ReturnNoteBackup,
} from "../domain/returnNote";

/**
 * Where the return note (domain/returnNote.ts) is kept so an uninstall can't take it:
 *
 *  - iPhone: the Keychain (expo-secure-store). It outlives deleting the app.
 *  - Android: `files/songnook-return.json`. Uninstalling deletes it, but it is the one
 *    file Android's Google backup carries (plugins/withSongNookBackupRules.js), and Play
 *    puts it back when the app is reinstalled. The secure store is no use here: Android
 *    wipes it on uninstall.
 *
 * The file sits outside `songnook/`, so no SongNook backup or export ever includes it.
 */
export const RETURN_NOTE_FILE = "songnook-return.json";
const RETURN_NOTE_KEY = "songnook.returnNote";

type SecureStore = {
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
};

let secureStoreModule: SecureStore | null | undefined;
function secureStore(): SecureStore | null {
    if (secureStoreModule !== undefined) return secureStoreModule;
    try {
        secureStoreModule = requireOptionalNativeModule("ExpoSecureStore")
            ? (require("expo-secure-store") as SecureStore)
            : null;
    } catch {
        secureStoreModule = null;
    }
    return secureStoreModule;
}

const noteFileUri = () => (FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${RETURN_NOTE_FILE}` : null);

async function readRawNote(): Promise<string | null> {
    if (Platform.OS === "ios") {
        return (await secureStore()?.getItemAsync(RETURN_NOTE_KEY).catch(() => null)) ?? null;
    }
    const uri = noteFileUri();
    if (!uri) return null;
    try {
        const info = await FileSystem.getInfoAsync(uri);
        return info.exists ? await FileSystem.readAsStringAsync(uri) : null;
    } catch {
        return null;
    }
}

async function writeRawNote(raw: string): Promise<void> {
    if (Platform.OS === "ios") {
        await secureStore()?.setItemAsync(RETURN_NOTE_KEY, raw).catch(() => {});
        return;
    }
    const uri = noteFileUri();
    if (!uri) return;
    await FileSystem.writeAsStringAsync(uri, raw).catch(() => {});
}

export async function readReturnNote(): Promise<ReturnNote | null> {
    return parseReturnNote(await readRawNote());
}

// Writes queue behind each other: a backup finishing while founding is recorded must
// not have one read-merge-write overwrite the other.
let queue: Promise<unknown> = Promise.resolve();

function update(change: Parameters<typeof mergeReturnNote>[1]): Promise<void> {
    const next = queue.then(async () => {
        const previous = await readReturnNote();
        const merged = mergeReturnNote(previous, change);
        if (previous && JSON.stringify(previous) === JSON.stringify(merged)) return;
        await writeRawNote(JSON.stringify(merged));
    });
    queue = next.catch(() => {});
    return next.catch(() => {});
}

/** A backup finished (manual file or the automatic folder). */
export function noteBackupFinished(backup: ReturnNoteBackup): Promise<void> {
    return update({ backup });
}

/** This install is a founding member: kept through a reinstall. */
export function noteFounding(): Promise<void> {
    return update({ founding: true });
}

/** A bought Pro was seen: a returning person is offered it back on their tap. */
export function notePro(): Promise<void> {
    return update({ pro: true });
}

/** Tests only. */
export function resetReturnNoteForTests(store: SecureStore | null) {
    secureStoreModule = store;
    queue = Promise.resolve();
}

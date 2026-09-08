import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getCrashLogUri } from "./crashLog";
import { flushPersistLog, readPersistLogEntries } from "./persistLog";

/**
 * One shareable file for a bug report: app version, the crash log, and the persistence
 * journal. Built on demand so the two logs never have to be shared separately.
 */
const BUNDLE_PATH = `${FileSystem.documentDirectory ?? ""}diagnostics/songnook-diagnostics.json`;

export async function buildDiagnosticsBundle(): Promise<string> {
    await flushPersistLog();
    let crashes: unknown = [];
    const crashUri = await getCrashLogUri();
    if (crashUri) {
        try {
            crashes = JSON.parse(await FileSystem.readAsStringAsync(crashUri));
        } catch {
            crashes = "unreadable";
        }
    }
    const persist = await readPersistLogEntries();
    const bundle = {
        app: {
            version: Constants.expoConfig?.version ?? null,
            platform: Platform.OS,
            platformVersion: String(Platform.Version),
        },
        generatedAt: new Date().toISOString(),
        crashes,
        persist,
    };
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory ?? ""}diagnostics`, {
        intermediates: true,
    }).catch(() => {});
    await FileSystem.writeAsStringAsync(BUNDLE_PATH, JSON.stringify(bundle, null, 2));
    return BUNDLE_PATH;
}

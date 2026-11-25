import { useStore } from "../state/useStore";
import { pickBackupFolder } from "./backupFolderPicker";
import { runAutomaticBackupNow } from "./automaticBackupRunner";
import type { AutomaticBackupFrequency } from "../domain/automaticBackupPrefs";

/**
 * Pick the folder and turn automatic backup on, then fill the folder now. Returns
 * "on", "backedOut" (the picker was closed) or "failed" (the folder couldn't be kept).
 * The same steps as Settings → Data & storage → Automatic backup.
 */
export async function turnOnAutomaticBackup(
    frequency: Exclude<AutomaticBackupFrequency, "off"> = "daily"
): Promise<"on" | "backedOut" | "failed"> {
    let picked;
    try {
        const current = useStore.getState().automaticBackup;
        // A folder the phone no longer lets us reach is asked for again.
        picked = current.lastError === "folderUnavailable" ? await pickBackupFolder() : current.folder ?? (await pickBackupFolder());
    } catch (error) {
        console.warn("[AutoBackup] folder pick failed", error);
        return "failed";
    }
    if (!picked) return "backedOut";
    useStore.getState().updateAutomaticBackup({ folder: picked, frequency, lastError: null });
    void runAutomaticBackupNow({ userStarted: true });
    return "on";
}

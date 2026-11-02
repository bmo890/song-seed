import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { Directory } from "expo-file-system";
import { nativeBackupFolder } from "../../modules/songnook-file-io";

export type PickedBackupFolder = { handle: string; name: string };

/**
 * Ask the person for a folder once and keep access to it across launches: on iPhone a
 * Files folder (iCloud Drive keeps it off the phone) held by a bookmark; on Android a
 * Storage Access Framework folder held by a persisted grant. Null when they back out.
 */
export async function pickBackupFolder(): Promise<PickedBackupFolder | null> {
    let uri: string;
    if (Platform.OS === "android") {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) return null;
        uri = permission.directoryUri;
    } else {
        try {
            uri = (await Directory.pickDirectoryAsync()).uri;
        } catch (error) {
            if (error instanceof Error && /cancel/i.test(error.message)) return null;
            throw error;
        }
    }
    const handle = await nativeBackupFolder.bookmark(uri);
    const resolved = await nativeBackupFolder.resolve(handle);
    return { handle: resolved.handle, name: resolved.name };
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { importRecordedAudioAsset } from "./audioStorage";
import { useStore } from "../state/useStore";
import { appActions } from "../state/actions";

const PENDING_RECORDING_KEY = "song-seed-pending-recording";

type PendingRecordingSession = {
    fileUri: string;
    startedAt: number;
    updatedAt: number;
};

export type RecordingRecoveryResult =
    | { status: "none" }
    | { status: "recovered"; title: string }
    | { status: "missing" }
    | { status: "failed"; message: string };

function buildRecoveredRecordingTitle(startedAt: number) {
    return `Recovered Recording ${new Date(startedAt).toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })}`;
}

async function readPendingRecordingSession(): Promise<PendingRecordingSession | null> {
    try {
        const raw = await AsyncStorage.getItem(PENDING_RECORDING_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PendingRecordingSession;
        if (typeof parsed.fileUri !== "string" || !Number.isFinite(parsed.startedAt)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export async function persistPendingRecordingSession(fileUri: string, startedAt: number) {
    await AsyncStorage.setItem(
        PENDING_RECORDING_KEY,
        JSON.stringify({
            fileUri,
            startedAt,
            updatedAt: Date.now(),
        } satisfies PendingRecordingSession)
    );
}

export async function clearPendingRecordingSession() {
    await AsyncStorage.removeItem(PENDING_RECORDING_KEY);
}

export async function recoverPendingRecordingSession(): Promise<RecordingRecoveryResult> {
    const session = await readPendingRecordingSession();
    if (!session) {
        return { status: "none" };
    }

    try {
        const info = await FileSystem.getInfoAsync(session.fileUri);
        if (!info.exists || (typeof info.size === "number" && info.size <= 0)) {
            await clearPendingRecordingSession();
            return { status: "missing" };
        }

        const store = useStore.getState();
        const workspaceId =
            store.activeWorkspaceId ??
            store.workspaces.find((workspace) => !workspace.isArchived)?.id ??
            null;

        if (!workspaceId) {
            return { status: "failed", message: "No active workspace available for recovery." };
        }

        const workspace = store.workspaces.find((candidate) => candidate.id === workspaceId) ?? null;
        const collectionId =
            workspace?.collections[0]?.id ?? store.addCollection(workspaceId, "Inbox", null);

        const clipId = `recovered-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const managedAudio = await importRecordedAudioAsset(session.fileUri, clipId);
        const title = buildRecoveredRecordingTitle(session.startedAt);

        appActions.importClipToCollection(collectionId, {
            title,
            audioUri: managedAudio.audioUri,
            durationMs: managedAudio.durationMs,
            waveformPeaks: managedAudio.waveformPeaks,
            createdAt: session.startedAt,
            importedAt: Date.now(),
            sourceCreatedAt: session.startedAt,
        });

        if (session.fileUri !== managedAudio.audioUri) {
            await FileSystem.deleteAsync(session.fileUri, { idempotent: true }).catch(() => {});
        }

        await clearPendingRecordingSession();
        return { status: "recovered", title };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown recovery failure.";
        console.warn("[RecordingRecovery] Failed to recover pending recording", error);
        return { status: "failed", message };
    }
}

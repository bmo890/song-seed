import { useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useStore } from "../../state/useStore";
import { useProcessStore } from "../../state/useProcessStore";
import { shouldAskAboutAutomaticBackup } from "../../domain/automaticBackupPrefs";
import { turnOnAutomaticBackup } from "../../services/automaticBackupSetup";
import { isBackupFolderAvailable } from "../../../modules/songnook-file-io";
import { AppAlert } from "./AppAlert";
import { afterOverlayCloses } from "./afterOverlayCloses";
import { dialogStore } from "./dialogStore";
import { haptic } from "../../design/haptics";

const ASKED_KEY = "songnook.automaticBackupAsked";
/** How often a waiting question looks again for a quiet moment (no dialog, no sheet). */
const QUIET_CHECK_MS = 1500;

/**
 * Asks once whether to keep an automatic backup (founder, 2026-11-25): after the first
 * idea lands, at a quiet moment (no take running, no dialog or sheet up). "Choose
 * folder" picks it and starts the daily copy; "Not now" never asks again. Settings →
 * Data & storage keeps the same switch for later. Renders nothing.
 */
export function AutomaticBackupAsk() {
    const { t } = useTranslation();
    const ideaCount = useStore((s) => s.workspaces.reduce((sum, ws) => sum + ws.ideas.length, 0));
    const hasSeenWelcome = useStore((s) => s.hasSeenWelcome);
    const recording = useStore((s) => s.recordingIdeaId != null);
    const prefs = useStore((s) => s.automaticBackup);
    // null until read; true once asked (this launch or any before).
    const [asked, setAsked] = useState<boolean | null>(null);

    useEffect(() => {
        let live = true;
        void AsyncStorage.getItem(ASKED_KEY)
            .catch(() => null)
            .then((value) => {
                if (live) setAsked((current) => current ?? value === "1");
            });
        return () => {
            live = false;
        };
    }, []);

    const due =
        asked === false &&
        shouldAskAboutAutomaticBackup({
            asked: false,
            ideaCount,
            prefs,
            hasSeenWelcome,
            recording,
            folderAvailable: isBackupFolderAvailable(),
        });

    useEffect(() => {
        if (!due) return;
        const timer = setInterval(() => {
            // A quiet moment: no dialog or sheet, no take, no backup/restore/import running.
            if (dialogStore.isBusy() || useStore.getState().recordingIdeaId != null) return;
            if (useProcessStore.getState().process?.status === "running") return;
            clearInterval(timer);
            setAsked(true);
            void AsyncStorage.setItem(ASKED_KEY, "1").catch(() => {});
            AppAlert.custom(
                t("backupAsk.title"),
                Platform.OS === "ios" ? t("backupAsk.bodyIos") : t("backupAsk.bodyAndroid"),
                [
                    { label: t("backupAsk.notNow"), style: "cancel" },
                    {
                        label: t("backupAsk.choose"),
                        style: "default",
                        icon: "folder-outline",
                        onPress: () => {
                            // The picker waits for the dialog to leave, or iOS refuses it.
                            void afterOverlayCloses()
                                .then(() => turnOnAutomaticBackup("daily"))
                                .then((outcome) => {
                                    if (outcome === "failed") {
                                        haptic.error();
                                        AppAlert.error(t("settingsBackup.folderFailedTitle"), t("settingsBackup.folderFailed"));
                                    }
                                });
                        },
                    },
                ]
            );
        }, QUIET_CHECK_MS);
        return () => clearInterval(timer);
    }, [due, t]);

    return null;
}

import { useEffect } from "react";
import { AppState } from "react-native";
import { runAutomaticBackupIfDue } from "../services/automaticBackupRunner";

/** Settle time after launch or return to the app before a run is considered. */
const SETTLE_MS = 30 * 1000;
/** How often an open, idle app checks whether a run is due. */
const CHECK_EVERY_MS = 10 * 60 * 1000;

/**
 * Automatic backup runs while the app is open and idle, when due (decision C). The
 * runner itself waits for idle hands and skips while recording or another heavy
 * operation runs, so this only decides WHEN to ask.
 */
export function useAutomaticBackupScheduler(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        let settle: ReturnType<typeof setTimeout> | null = null;
        const check = () => {
            if (AppState.currentState !== "active") return;
            void runAutomaticBackupIfDue().catch((error) => console.warn("[AutoBackup] check failed", error));
        };
        const checkSoon = () => {
            if (settle) clearTimeout(settle);
            settle = setTimeout(check, SETTLE_MS);
        };
        checkSoon();
        const interval = setInterval(check, CHECK_EVERY_MS);
        const subscription = AppState.addEventListener("change", (next) => {
            if (next === "active") checkSoon();
        });
        return () => {
            if (settle) clearTimeout(settle);
            clearInterval(interval);
            subscription.remove();
        };
    }, [enabled]);
}

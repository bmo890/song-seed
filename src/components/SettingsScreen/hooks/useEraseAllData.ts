import { useCallback, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { useTranslation } from "react-i18next";
import { AppAlert } from "../../common/AppAlert";
import { haptic } from "../../../design/haptics";
import { eraseAllAppData } from "../../../services/eraseAllData";

/**
 * "Erase everything" — two destructive confirmations, then the device's own lock
 * (biometric with PIN/pattern fallback) when one is enrolled, then the wipe and a reload
 * into first launch. Founder's calls (2026-09-07): two dialogs are the floor; device
 * auth is an extra gate only when the phone has one.
 */
export function useEraseAllData() {
    const { t } = useTranslation();
    const [isErasing, setIsErasing] = useState(false);

    const runErase = useCallback(async () => {
        setIsErasing(true);
        try {
            const result = await eraseAllAppData();
            // Reached only if the reload did not happen (it normally never returns).
            if (result.failures.length > 0) {
                haptic.error(); // haptics vocabulary: a failed outcome the user must not miss
                AppAlert.info(t("eraseAll.failedTitle"), t("eraseAll.failedBody"));
            }
        } finally {
            setIsErasing(false);
        }
    }, [t]);

    const authenticateThenErase = useCallback(async () => {
        let level = LocalAuthentication.SecurityLevel.NONE;
        try {
            level = await LocalAuthentication.getEnrolledLevelAsync();
        } catch {
            level = LocalAuthentication.SecurityLevel.NONE;
        }
        if (level !== LocalAuthentication.SecurityLevel.NONE) {
            let ok = false;
            try {
                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: t("eraseAll.authPrompt"),
                    cancelLabel: t("common.cancel"),
                    disableDeviceFallback: false,
                });
                ok = result.success;
            } catch {
                ok = false;
            }
            if (!ok) {
                haptic.error(); // the gate refused — a failed outcome
                return;
            }
        }
        await runErase();
    }, [runErase, t]);

    const confirmErase = useCallback(() => {
        // Dialogs with a destructive button fire `warning` on their own (AppDialogHost).
        AppAlert.destructive(
            t("eraseAll.confirmTitle"),
            t("eraseAll.confirmBody"),
            () => {
                AppAlert.destructive(
                    t("eraseAll.finalTitle"),
                    t("eraseAll.finalBody"),
                    () => {
                        void authenticateThenErase();
                    },
                    { confirmLabel: t("eraseAll.finalConfirm") }
                );
            },
            { confirmLabel: t("eraseAll.confirm") }
        );
    }, [authenticateThenErase, t]);

    return { confirmErase, isErasing };
}

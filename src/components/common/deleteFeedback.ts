import { i18n } from "../../i18n";
import { haptic } from "../../design/haptics";
import { useStore } from "../../state/useStore";
import { restoreRecentlyDeleted } from "../../state/recentlyDeletedActions";
import type { RestoreOutcome } from "../../state/recentlyDeleted";
import { AppAlert } from "./AppAlert";
import { toast } from "./toastStore";

/** The one-time note: the first delete ever says where deleted things go. */
export const RECENTLY_DELETED_INTRO_HINT = "recentlyDeletedIntro";

/**
 * What a person sees after a delete (decision A, 2026-11-02). The very first
 * delete ever explains Recently deleted once (30 days, emptied in Settings ›
 * Library); after that a quiet toast says where it went, with Undo. Screens
 * with their own undo bar pass `toast: false` and still get the first note.
 */
export function announceDeleted(recordIds: string[], opts: { toast?: boolean } = {}): void {
    if (recordIds.length === 0) return;
    const store = useStore.getState();
    if (!store.seenHints.includes(RECENTLY_DELETED_INTRO_HINT)) {
        store.markHintSeen(RECENTLY_DELETED_INTRO_HINT);
        AppAlert.info(i18n.t("recentlyDeleted.introTitle"), i18n.t("recentlyDeleted.introBody"));
        return;
    }
    if (opts.toast === false) return;
    toast(i18n.t("recentlyDeleted.movedToast"), "trash-outline", {
        action: { label: i18n.t("recentlyDeleted.undo"), onPress: () => void undoDelete(recordIds) },
    });
}

/** Run a delete (or several) and return the Recently deleted records it made. */
export function recordsMadeBy(work: () => unknown): string[] {
    const before = new Set(useStore.getState().recentlyDeleted.map((item) => item.id));
    work();
    return useStore
        .getState()
        .recentlyDeleted.filter((item) => !before.has(item.id))
        .map((item) => item.id);
}

/** A delete from a screen without its own undo bar: run it, then say where it went. */
export function deleteWithUndo(work: () => unknown): string[] {
    const ids = recordsMadeBy(work);
    announceDeleted(ids);
    return ids;
}

/** Put records back and say where, plainly, when their place was gone. */
export async function undoDelete(recordIds: string[]): Promise<RestoreOutcome[]> {
    try {
        const outcomes = await restoreRecentlyDeleted(recordIds);
        sayRestored(outcomes);
        return outcomes;
    } catch (error) {
        console.warn("[RecentlyDeleted] Restore failed", error);
        AppAlert.error(i18n.t("recentlyDeleted.restoreFailed"));
        return [];
    }
}

/** The toast after a restore: where it landed when that is not where it was. */
export function sayRestored(outcomes: RestoreOutcome[]): void {
    const back = outcomes.filter((outcome) => outcome.status !== "skipped");
    if (back.length === 0) return;
    // haptics vocabulary: `success` — a completion, paired with its toast.
    haptic.success();
    const moved = back.find((outcome) => outcome.status === "moved" && outcome.placeTitle);
    if (moved) {
        toast(i18n.t("recentlyDeleted.restoredTo", { place: moved.placeTitle }), "arrow-undo-outline");
        return;
    }
    toast(i18n.t("recentlyDeleted.restored", { count: back.length }), "arrow-undo-outline");
}

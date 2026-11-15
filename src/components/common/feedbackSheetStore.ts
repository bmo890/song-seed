import { useSyncExternalStore } from "react";

/**
 * Global store for the one feedback sheet. Settings' rows call openFeedbackSheet()
 * and the app-root <FeedbackHost> renders it. Mirrors proUpsell.ts. The words typed
 * live here, so a sheet swiped away mid-thought opens again with them; they clear
 * once the note is sent. The reply email stays for the next note (this session only).
 */

type FeedbackSheetState = { visible: boolean; draft: string; email: string };

let state: FeedbackSheetState = { visible: false, draft: "", email: "" };
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

export function openFeedbackSheet() {
    if (state.visible) return;
    state = { ...state, visible: true };
    notify();
}

export function closeFeedbackSheet() {
    if (!state.visible) return;
    state = { ...state, visible: false };
    notify();
}

export function setFeedbackDraft(draft: string) {
    state = { ...state, draft };
    notify();
}

export function setFeedbackEmail(email: string) {
    state = { ...state, email };
    notify();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useFeedbackSheetState(): FeedbackSheetState {
    return useSyncExternalStore(subscribe, () => state);
}

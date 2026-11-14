import { useSyncExternalStore } from "react";
import { hasProAccess, isOnFreeMonth, type ProFeature } from "../../domain/entitlements";
import { noteProUse } from "../../services/proUse";
import { useStore } from "../../state/useStore";

/**
 * Global visibility store for the single Pro page (ProUpsellSheet.tsx). Any gated call site calls
 * openProUpsell(feature) and the app-root <ProUpsellHost> renders the page — one paywall,
 * no bespoke per-feature screens. Mirrors the app's other external stores (proEntitlement,
 * toast/dialog) rather than adding a provider.
 */

type ProUpsellState = { visible: boolean; feature?: ProFeature };

let state: ProUpsellState = { visible: false };
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

/** Open the Pro page, optionally remembering which feature triggered it (for analytics/copy). */
export function openProUpsell(feature?: ProFeature) {
    state = { visible: true, feature };
    notify();
}

export function closeProUpsell() {
    if (!state.visible) return;
    state = { visible: false, feature: state.feature };
    notify();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useProUpsellState(): ProUpsellState {
    return useSyncExternalStore(subscribe, () => state);
}

/**
 * Gate helper for imperative call sites. Returns true if the user may proceed; otherwise
 * opens the Pro page and returns false. Pass a precomputed `allowed` for count-based
 * gates (e.g. canAddOverdubLayer(count, hasProAccess(feature))); omit it for a plain
 * feature gate. Use at the top of the "do the Pro thing" handler: `if (!ensurePro(...)) return;`.
 */
export function ensurePro(feature: ProFeature, allowed?: boolean): boolean {
    const ok = allowed ?? hasProAccess(feature);
    if (!ok) openProUpsell(feature);
    else countProUse(feature);
    return ok;
}

/**
 * A Pro tool was used. Counted only during the free month, on the phone, so the Pro
 * page can name what this person used when the month ends (services/proUse.ts). Every
 * gate through `ensurePro` counts by itself; a gate with its own check calls this.
 */
export function countProUse(feature: ProFeature): void {
    if (isOnFreeMonth()) noteProUse(feature);
}

/**
 * A parcel that arrived through SongNook Send (a received package) is the sender's to
 * share: the Pro tools that USE it (transpose, capo, the stage reader, practice) work on
 * it for everyone, so a free bandmate can rehearse the set a Pro user sent (founder,
 * 2026-10-23). Making new things from it stays gated like anywhere else.
 */
export function isReceivedIdea(ideaId: string | null | undefined): boolean {
    if (!ideaId) return false;
    return useStore
        .getState()
        .workspaces.some((workspace) => workspace.origin === "received" && workspace.ideas.some((idea) => idea.id === ideaId));
}

/** ensurePro for a tool used ON an idea: free when the idea came in a received parcel. */
export function ensureProFor(feature: ProFeature, ideaId: string | null | undefined): boolean {
    return ensurePro(feature, hasProAccess(feature) || isReceivedIdea(ideaId));
}

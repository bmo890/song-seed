import { useSyncExternalStore } from "react";
import { hasProAccess, type ProFeature } from "../../domain/entitlements";

/**
 * Global visibility store for the single ProUpsellSheet. Any gated call site calls
 * openProUpsell(feature) and the app-root <ProUpsellHost> renders the sheet — one paywall,
 * no bespoke per-feature screens. Mirrors the app's other external stores (proEntitlement,
 * toast/dialog) rather than adding a provider.
 */

type ProUpsellState = { visible: boolean; feature?: ProFeature };

let state: ProUpsellState = { visible: false };
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

/** Open the upsell sheet, optionally remembering which feature triggered it (for analytics/copy). */
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
 * opens the upsell sheet and returns false. Pass a precomputed `allowed` for count-based
 * gates (e.g. canAddOverdubLayer(count, hasProAccess(feature))); omit it for a plain
 * feature gate. Use at the top of the "do the Pro thing" handler: `if (!ensurePro(...)) return;`.
 */
export function ensurePro(feature: ProFeature, allowed?: boolean): boolean {
    const ok = allowed ?? hasProAccess(feature);
    if (!ok) openProUpsell(feature);
    return ok;
}

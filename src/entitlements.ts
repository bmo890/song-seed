import { useSyncExternalStore } from "react";

/**
 * Pro-entitlement gate (stub).
 *
 * Everything is free today, so `ALL_FEATURES_FREE` short-circuits every check and nothing is
 * actually withheld. This exists to establish the seam: when real billing (RevenueCat or
 * native StoreKit/Play Billing) is wired in, flip `ALL_FEATURES_FREE` to false and drive
 * `proEntitlement` from the purchase/entitlement state. Gated call sites won't need to change.
 */

const ALL_FEATURES_FREE = true;

/** Pro feature keys — extend as gated features are introduced (e.g. managed cloud sync). */
export type ProFeature = "cloud-backup" | "auto-backup";

let isProState = false;
const listeners = new Set<() => void>();

export const proEntitlement = {
    get: () => isProState,
    /** Set by the billing layer once it exists; no-op-relevant while everything is free. */
    set(value: boolean) {
        if (value === isProState) return;
        isProState = value;
        listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

/** Imperative check: whether the user may use `feature`. All features are free for now. */
export function hasProAccess(_feature?: ProFeature): boolean {
    return ALL_FEATURES_FREE || isProState;
}

/** Reactive entitlement flag. */
export function useIsPro(): boolean {
    return useSyncExternalStore(proEntitlement.subscribe, proEntitlement.get);
}

/** Reactive feature check; re-renders when entitlement changes. */
export function useHasProAccess(feature?: ProFeature): boolean {
    const isPro = useIsPro();
    return ALL_FEATURES_FREE || (isPro && hasProAccess(feature));
}

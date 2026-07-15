import { useSyncExternalStore } from "react";

/**
 * Pro-entitlement gate.
 *
 * Everything is free today, so `ALL_FEATURES_FREE` short-circuits every access check and
 * nothing is actually withheld. The seam is fully built so that when real billing lands
 * (RevenueCat — see docs/product-plan/phase-6-monetization.md), flipping this ONE flag to
 * false and driving `proEntitlement` from the purchase/entitlement state turns on the split
 * without touching any gated call site.
 *
 * NEVER gate the act of capturing music, backing up, or opening existing work — gates apply
 * only to creating NEW Pro-tier content. (House principle from the 2026-07 audit.)
 */

const ALL_FEATURES_FREE = true;

/** Pro feature keys. Extend as gated features are introduced. */
export type ProFeature =
    | "cloud-backup"
    | "auto-backup"
    | "practice-suite"
    | "overdub-layers"
    | "word-sparks-unlimited"
    | "archive-offload"
    | "pdf-export";

let isProState = false;

const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

export const proEntitlement = {
    get: () => isProState,
    /** Set by the billing layer once it exists; no-op-relevant while everything is free. */
    set(value: boolean) {
        if (value === isProState) return;
        isProState = value;
        notify();
    },
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

/** Whether the user is a paying Pro SUBSCRIBER (drives "you're Pro" surfaces / upsell visibility). */
function isProSubscriber(): boolean {
    return isProState;
}

/** Imperative check: whether the user may USE `feature`. All features are free for now. */
export function hasProAccess(_feature?: ProFeature): boolean {
    return ALL_FEATURES_FREE || isProState;
}

/** Reactive subscriber flag — re-renders when the entitlement changes. */
export function useIsPro(): boolean {
    return useSyncExternalStore(proEntitlement.subscribe, isProSubscriber);
}

/** Reactive feature check; re-renders when the entitlement changes. */
export function useHasProAccess(feature?: ProFeature): boolean {
    return useSyncExternalStore(proEntitlement.subscribe, () => hasProAccess(feature));
}

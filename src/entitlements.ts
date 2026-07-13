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

/**
 * Dev-only override to exercise BOTH the free and the gated UX without real billing and
 * without flipping ALL_FEATURES_FREE. `null` = follow the real entitlement; `true`/`false`
 * force the effective state. A no-op in production builds.
 */
let devProOverride: boolean | null = null;

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

/**
 * Force the effective Pro state in development so gated UX can be tested against the still-true
 * ALL_FEATURES_FREE flag. `null` restores normal behavior. No effect in production.
 */
export function setDevProOverride(value: boolean | null) {
    if (!__DEV__) return;
    if (value === devProOverride) return;
    devProOverride = value;
    notify();
}

export function getDevProOverride(): boolean | null {
    return __DEV__ ? devProOverride : null;
}

/** Whether the user is a paying Pro SUBSCRIBER (drives "you're Pro" surfaces / upsell visibility). */
function isProSubscriber(): boolean {
    if (__DEV__ && devProOverride !== null) return devProOverride;
    return isProState;
}

/** Imperative check: whether the user may USE `feature`. All features are free for now. */
export function hasProAccess(_feature?: ProFeature): boolean {
    if (__DEV__ && devProOverride !== null) return devProOverride;
    return ALL_FEATURES_FREE || isProState;
}

/** Reactive subscriber flag — re-renders when entitlement OR the dev override changes. */
export function useIsPro(): boolean {
    return useSyncExternalStore(proEntitlement.subscribe, isProSubscriber);
}

/** Reactive feature check; re-renders when entitlement OR the dev override changes. */
export function useHasProAccess(feature?: ProFeature): boolean {
    return useSyncExternalStore(proEntitlement.subscribe, () => hasProAccess(feature));
}

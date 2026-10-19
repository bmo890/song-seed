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

// The free month and founding membership (domain/freeMonth.ts): access without a
// purchase. Set by services/freeMonthClock once the stored dates are read.
let freeMonthEndsAt: number | null = null;
let foundingMember = false;
let freeMonthExpiryTimer: ReturnType<typeof setTimeout> | null = null;

/** When the free month ends (ms), or null before the clock has been read. */
export function getFreeMonthEndsAt(): number | null {
    return freeMonthEndsAt;
}

/** A founding member (first launch before the App Store release) keeps Pro. */
export function isFoundingMember(): boolean {
    return foundingMember;
}

/** Whether the paywall is live at all: false while everything is free. Free-month notes key off it. */
export function isPaywallLive(): boolean {
    return !ALL_FEATURES_FREE;
}

function freeMonthOpen(): boolean {
    return freeMonthEndsAt != null && Date.now() < freeMonthEndsAt;
}

/**
 * Access without a purchase: the free month's end and founding membership. Re-renders
 * gates when the month runs out while the app is open.
 */
export function setPurchaseFreeAccess(next: { freeMonthEndsAt: number | null; founding: boolean }) {
    freeMonthEndsAt = next.freeMonthEndsAt;
    foundingMember = next.founding;
    if (freeMonthExpiryTimer) clearTimeout(freeMonthExpiryTimer);
    freeMonthExpiryTimer = null;
    const remaining = freeMonthEndsAt != null ? freeMonthEndsAt - Date.now() : -1;
    // setTimeout tops out near 24.8 days; a longer wait is re-armed on the next launch.
    if (remaining > 0 && remaining < 2 ** 31 - 1) {
        freeMonthExpiryTimer = setTimeout(() => {
            freeMonthExpiryTimer = null;
            notify();
        }, remaining + 1000);
    }
    notify();
}

/**
 * Dev-only override to exercise BOTH the free and the gated UX without real billing and
 * without flipping ALL_FEATURES_FREE. `null` = follow the real entitlement; `true`/`false`
 * force the effective state. A no-op in production builds. Nothing imports the setter —
 * it is invoked from the JS debugger console by the QA flows (docs/qa/flows/
 * lyrics-words.md LYR-22, LYR-60), so do NOT remove it as dead code.
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

/**
 * Imperative check: whether the user may USE `feature`. All features are free for now;
 * once the paywall is live, Pro comes from a purchase, the free month, or founding.
 */
export function hasProAccess(_feature?: ProFeature): boolean {
    if (__DEV__ && devProOverride !== null) return devProOverride;
    return ALL_FEATURES_FREE || isProState || foundingMember || freeMonthOpen();
}

/** Reactive subscriber flag — re-renders when entitlement OR the dev override changes. */
export function useIsPro(): boolean {
    return useSyncExternalStore(proEntitlement.subscribe, isProSubscriber);
}

/** Reactive feature check; re-renders when entitlement OR the dev override changes. */
export function useHasProAccess(feature?: ProFeature): boolean {
    return useSyncExternalStore(proEntitlement.subscribe, () => hasProAccess(feature));
}

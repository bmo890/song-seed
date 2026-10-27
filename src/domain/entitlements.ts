import { useSyncExternalStore } from "react";
import { isProFeature, type ProFeature } from "./proCatalog";

/**
 * Pro-entitlement gate.
 *
 * Everything is free today, so `ALL_FEATURES_FREE` short-circuits every access check and
 * nothing is actually withheld. The seam is fully built so that when real billing lands
 * (RevenueCat — see docs/product-plan/phase-6-monetization.md), flipping this ONE flag to
 * false and driving `proEntitlement` from the purchase/entitlement state turns on the split
 * without touching any gated call site.
 *
 * WHICH features are Pro is decided in ONE table, domain/proCatalog.ts: a key whose row
 * says `pro: false` is free for everyone whatever this flag says.
 *
 * NEVER gate the act of capturing music, backing up, or opening existing work — gates apply
 * only to creating NEW Pro-tier content. (House principle from the 2026-07 audit.)
 */

const ALL_FEATURES_FREE = true;

/** Pro feature keys: the catalog's rows (domain/proCatalog.ts). */
export type { ProFeature } from "./proCatalog";

let isProState = false;

// The free month and founding membership (domain/freeMonth.ts): access without a
// purchase. Set by services/freeMonthClock once the stored dates are read.
let freeMonthEndsAt: number | null = null;
// The latest moment the clock has been seen at (services/freeMonthClock.ts): a device
// date set back does not reopen the month in-session either.
let freeMonthSeenAt = 0;
let foundingMember = false;
let freeMonthExpiryTimer: ReturnType<typeof setTimeout> | null = null;

/** When the free month ends (ms), or null before the clock has been read. */
export function getFreeMonthEndsAt(): number | null {
    return freeMonthEndsAt;
}

/** The clock the month is judged by: now, or the latest moment already seen if later. */
export function getFreeMonthClock(): number {
    return Math.max(Date.now(), freeMonthSeenAt);
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
    return freeMonthEndsAt != null && getFreeMonthClock() < freeMonthEndsAt;
}

/**
 * Access without a purchase: the free month's end and founding membership. Re-renders
 * gates when the month runs out while the app is open.
 */
export function setPurchaseFreeAccess(next: { freeMonthEndsAt: number | null; founding: boolean; seenAt?: number }) {
    freeMonthEndsAt = next.freeMonthEndsAt;
    foundingMember = next.founding;
    if (next.seenAt != null && next.seenAt > freeMonthSeenAt) freeMonthSeenAt = next.seenAt;
    if (freeMonthExpiryTimer) clearTimeout(freeMonthExpiryTimer);
    freeMonthExpiryTimer = null;
    const remaining = freeMonthEndsAt != null ? freeMonthEndsAt - getFreeMonthClock() : -1;
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
 * once the paywall is live, Pro comes from a purchase, the free month, or founding. A
 * feature the catalog marks `pro: false` is free for everyone (the dev override included).
 */
export function hasProAccess(feature?: ProFeature): boolean {
    if (feature && !isProFeature(feature)) return true;
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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where the user stands, for the Settings plan line: a paying subscriber, a founding
 * install (Pro for good), inside the free month (with whole days left, counting
 * today), or free.
 */
export type PlanState =
    | { kind: "pro" }
    | { kind: "founding" }
    | { kind: "freeMonth"; daysLeft: number }
    | { kind: "free" };

/** A string snapshot, so useSyncExternalStore sees a stable value between changes. */
function planSnapshot(): string {
    if (isProSubscriber()) return "pro";
    if (foundingMember) return "founding";
    if (freeMonthOpen() && freeMonthEndsAt != null) {
        return `freeMonth:${Math.max(1, Math.ceil((freeMonthEndsAt - getFreeMonthClock()) / DAY_MS))}`;
    }
    return "free";
}

/** Reactive plan state; re-renders on a purchase, a restore or the month running out. */
export function usePlanState(): PlanState {
    const snapshot = useSyncExternalStore(proEntitlement.subscribe, planSnapshot);
    if (snapshot.startsWith("freeMonth:")) {
        return { kind: "freeMonth", daysLeft: Number(snapshot.slice("freeMonth:".length)) };
    }
    return { kind: snapshot as "pro" | "founding" | "free" };
}

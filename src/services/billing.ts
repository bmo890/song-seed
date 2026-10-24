import { NativeModules, Platform } from "react-native";
import { useSyncExternalStore } from "react";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { proEntitlement } from "../domain/entitlements";

/**
 * Billing through RevenueCat (wired 2026-10-24). Pro ships with v1 behind a 30-day free
 * month (phase-6-monetization.md); this module only answers "has this person BOUGHT Pro",
 * buys it and restores it. The free month and founding membership live in
 * services/freeMonthClock.ts; whether anything is gated at all is ALL_FEATURES_FREE.
 *
 * The products, the `songnook_pro` entitlement and the `default` offering (annual,
 * monthly, lifetime packages) are configured in the RevenueCat dashboard, project
 * SongNook. Persist NOTHING entitlement-related in the app store snapshot: it rides the
 * store account and RevenueCat.
 */

/**
 * RevenueCat's PUBLIC SDK keys. Public by design (they ship inside every app and can only
 * read this device's own purchases), so they live in code: OTA updates are published
 * without EAS build settings, and a key read from those would vanish from every update.
 * Release builds talk to the stores; development builds to RevenueCat's Test Store, so
 * the whole purchase flow runs in the simulator with no card and no Apple agreement.
 */
const REVENUECAT_KEYS = {
    ios: "appl_XntYTyjFaBGNrOwwbdcyhseGvdP",
    /** goog_… once the Play app exists in RevenueCat; until then Android has no billing. */
    android: null as string | null,
    test: "test_buUBQqhLdoJVWTwqerBRmFgzTNG",
};

/** The entitlement every Pro product unlocks (RevenueCat dashboard → Entitlements). */
export const PRO_ENTITLEMENT_ID = "songnook_pro";

export type ProPlan = "monthly" | "annual" | "lifetime";

export type BillingResult =
    | { ok: true }
    | { ok: false; reason: "unavailable" | "cancelled" | "nothing" | "error" };

export type ProPrices = Partial<Record<ProPlan, { price: string; perMonth: string | null }>>;

type PurchasesModule = typeof import("react-native-purchases").default;

let purchases: PurchasesModule | null = null;
let configured = false;
let packages: Partial<Record<ProPlan, PurchasesPackage>> = {};
let prices: ProPrices = {};
const priceListeners = new Set<() => void>();

function apiKey(): string | null {
    if (__DEV__) return REVENUECAT_KEYS.test;
    return Platform.OS === "ios" ? REVENUECAT_KEYS.ios : REVENUECAT_KEYS.android;
}

/** Builds from before billing don't carry the native side, and OTA updates still reach
 *  them: ask for it before loading the library (whose own fallback is a preview mode). */
function loadPurchases(): PurchasesModule | null {
    if (purchases) return purchases;
    if (!NativeModules.RNPurchases) return null;
    try {
        purchases = (require("react-native-purchases") as typeof import("react-native-purchases")).default;
    } catch {
        purchases = null;
    }
    return purchases;
}

function applyCustomerInfo(info: CustomerInfo) {
    proEntitlement.set(info.entitlements.active[PRO_ENTITLEMENT_ID] != null);
}

/** The current offering's three packages and their store prices, in the person's currency. */
async function loadOfferings(): Promise<void> {
    const P = loadPurchases();
    if (!P || !configured) return;
    try {
        const current = (await P.getOfferings()).current;
        if (!current) return;
        packages = {
            annual: current.annual ?? undefined,
            monthly: current.monthly ?? undefined,
            lifetime: current.lifetime ?? undefined,
        };
        const next: ProPrices = {};
        for (const plan of ["annual", "monthly", "lifetime"] as ProPlan[]) {
            const product = packages[plan]?.product;
            if (product) next[plan] = { price: product.priceString, perMonth: product.pricePerMonthString ?? null };
        }
        prices = next;
        priceListeners.forEach((listener) => listener());
    } catch (error) {
        console.warn("[billing] offerings unavailable", error);
    }
}

/** Store prices for the Pro sheet; empty until the store answers (the sheet falls back). */
export function useProPrices(): ProPrices {
    return useSyncExternalStore(
        (listener) => {
            priceListeners.add(listener);
            return () => priceListeners.delete(listener);
        },
        () => prices
    );
}

export function isBillingAvailable(): boolean {
    return configured;
}

/** Once per launch: configure RevenueCat, follow the entitlement live, fetch prices. */
export async function initBilling(): Promise<void> {
    if (configured) return;
    const key = apiKey();
    const P = loadPurchases();
    if (!key || !P) return;
    try {
        P.configure({ apiKey: key });
        configured = true;
        P.addCustomerInfoUpdateListener(applyCustomerInfo);
        applyCustomerInfo(await P.getCustomerInfo());
        void loadOfferings();
    } catch (error) {
        console.warn("[billing] init failed", error);
    }
}

export async function purchasePro(plan: ProPlan): Promise<BillingResult> {
    const P = loadPurchases();
    if (!P || !configured) return { ok: false, reason: "unavailable" };
    if (!packages[plan]) await loadOfferings();
    const pkg = packages[plan];
    if (!pkg) return { ok: false, reason: "unavailable" };
    try {
        const { customerInfo } = await P.purchasePackage(pkg);
        applyCustomerInfo(customerInfo);
        return customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] ? { ok: true } : { ok: false, reason: "error" };
    } catch (error) {
        if ((error as { userCancelled?: boolean | null })?.userCancelled) return { ok: false, reason: "cancelled" };
        console.warn("[billing] purchase failed", error);
        return { ok: false, reason: "error" };
    }
}

export async function restorePurchases(): Promise<BillingResult> {
    const P = loadPurchases();
    if (!P || !configured) return { ok: false, reason: "unavailable" };
    try {
        const info = await P.restorePurchases();
        applyCustomerInfo(info);
        return info.entitlements.active[PRO_ENTITLEMENT_ID] ? { ok: true } : { ok: false, reason: "nothing" };
    } catch (error) {
        console.warn("[billing] restore failed", error);
        return { ok: false, reason: "error" };
    }
}

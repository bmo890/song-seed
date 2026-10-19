import { proEntitlement } from "../domain/entitlements";

/**
 * Billing integration point (RevenueCat) — STUB.
 *
 * The whole free/Pro seam is built and testable, but real purchases are not wired yet.
 * Pro ships with v1 behind a 30-day free month (founder, 2026-10-19; see the header of
 * phase-6-monetization.md). Store products and agreements are set up; the RevenueCat
 * account is the last piece. Until it lands every entry point resolves to `unavailable`, so
 * the Pro sheet can be previewed without pretending to charge anyone.
 *
 * Wiring, once RevenueCat is set up (needs a new store build):
 *   - add `react-native-purchases`, init with the API key (EAS secret → app.config.js extra)
 *   - Purchases.addCustomerInfoUpdateListener → proEntitlement.set(active["pro"] != null)
 *   - purchasePro → Purchases.purchasePackage; restorePurchases → Purchases.restorePurchases
 * Persist NOTHING entitlement-related in the app store snapshot — it rides the store account.
 */

export type ProPlan = "monthly" | "annual" | "lifetime";

export type BillingResult = { ok: true } | { ok: false; reason: "unavailable" | "cancelled" | "error" };

// isBillingAvailable/initBilling are the pre-RevenueCat seam stubs from
// docs/product-plan/phase-6-monetization.md §6.1 — unused until phase 6 wires them.
export function isBillingAvailable(): boolean {
    return false;
}

export async function initBilling(): Promise<void> {
    // no-op until react-native-purchases is added and keyed
}

export async function purchasePro(_plan: ProPlan): Promise<BillingResult> {
    // Real impl: Purchases.purchasePackage(...) then proEntitlement.set(true) on success.
    void proEntitlement;
    return { ok: false, reason: "unavailable" };
}

export async function restorePurchases(): Promise<BillingResult> {
    return { ok: false, reason: "unavailable" };
}

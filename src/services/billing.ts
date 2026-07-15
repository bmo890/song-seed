import { proEntitlement } from "../entitlements";

/**
 * Billing integration point (RevenueCat) — STUB.
 *
 * The whole free/Pro seam is built and testable, but real purchases are deliberately not
 * wired yet: monetization ships 2–4 weeks AFTER launch (see phase-6-monetization.md), and
 * it needs the owner's RevenueCat account + App Store Connect / Play products + a signed
 * Paid Apps agreement. Until then every entry point resolves to `unavailable` so the paywall
 * can be previewed without pretending to charge anyone.
 *
 * Post-launch wiring (do NOT do pre-launch):
 *   - add `react-native-purchases`, init with the API key (EAS secret → app.config.js extra)
 *   - Purchases.addCustomerInfoUpdateListener → proEntitlement.set(active["pro"] != null)
 *   - purchasePro → Purchases.purchasePackage; restorePurchases → Purchases.restorePurchases
 * Persist NOTHING entitlement-related in the app store snapshot — it rides the store account.
 */

export type ProPlan = "monthly" | "annual" | "lifetime";

export type BillingResult = { ok: true } | { ok: false; reason: "unavailable" | "cancelled" | "error" };

export async function purchasePro(_plan: ProPlan): Promise<BillingResult> {
    // Real impl: Purchases.purchasePackage(...) then proEntitlement.set(true) on success.
    void proEntitlement;
    return { ok: false, reason: "unavailable" };
}

export async function restorePurchases(): Promise<BillingResult> {
    return { ok: false, reason: "unavailable" };
}

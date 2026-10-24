const active = (on: boolean) => ({ entitlements: { active: on ? { songnook_pro: {} } : {} } });

const mockPurchases = {
  configure: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  getCustomerInfo: jest.fn(async () => active(false)),
  getOfferings: jest.fn(async () => ({
    current: {
      annual: { product: { priceString: "₪99.90", pricePerMonthString: "₪8.33" } },
      monthly: { product: { priceString: "₪14.90", pricePerMonthString: "₪14.90" } },
      lifetime: { product: { priceString: "₪229.90", pricePerMonthString: null } },
    },
  })),
  purchasePackage: jest.fn(async () => ({ customerInfo: active(true) })),
  restorePurchases: jest.fn(async () => active(false)),
};

jest.mock("react-native-purchases", () => ({ __esModule: true, default: mockPurchases }));

function loadBilling(withNative: boolean) {
  jest.resetModules();
  const rn = require("react-native");
  rn.NativeModules.RNPurchases = withNative ? {} : undefined;
  const billing = require("../billing") as typeof import("../billing");
  const { proEntitlement } = require("../../domain/entitlements") as typeof import("../../domain/entitlements");
  return { billing, proEntitlement };
}

beforeEach(() => jest.clearAllMocks());

describe("billing through RevenueCat", () => {
  it("stays out of the way on a build without its native side", async () => {
    const { billing } = loadBilling(false);
    await billing.initBilling();
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    expect(billing.isBillingAvailable()).toBe(false);
    expect(await billing.purchasePro("annual")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("configures once with the Test Store key in development and follows the entitlement", async () => {
    const { billing, proEntitlement } = loadBilling(true);
    await billing.initBilling();
    await billing.initBilling();
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
    expect(mockPurchases.configure.mock.calls[0][0].apiKey).toMatch(/^test_/);
    expect(proEntitlement.get()).toBe(false);

    expect(await billing.purchasePro("annual")).toEqual({ ok: true });
    expect(proEntitlement.get()).toBe(true);
  });

  it("tells a cancelled purchase from a failed one", async () => {
    const { billing } = loadBilling(true);
    await billing.initBilling();
    mockPurchases.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    expect(await billing.purchasePro("monthly")).toEqual({ ok: false, reason: "cancelled" });
    mockPurchases.purchasePackage.mockRejectedValueOnce({ userCancelled: false, message: "network" });
    expect(await billing.purchasePro("monthly")).toEqual({ ok: false, reason: "error" });
  });

  it("says when there is nothing to restore", async () => {
    const { billing } = loadBilling(true);
    await billing.initBilling();
    expect(await billing.restorePurchases()).toEqual({ ok: false, reason: "nothing" });
    mockPurchases.restorePurchases.mockResolvedValueOnce(active(true));
    expect(await billing.restorePurchases()).toEqual({ ok: true });
  });
});

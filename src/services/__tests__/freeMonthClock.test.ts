jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { isFoundingMember } from "../../domain/entitlements";
import { setSecureStoreForTests, syncFreeMonth } from "../freeMonthClock";

const DAY = 24 * 60 * 60 * 1000;
const TESTER_START = Date.UTC(2026, 8, 20); // a TestFlight tester since September
const RELEASE = Date.UTC(2026, 11, 1);

/** The Keychain: survives reinstalls and Erase everything. */
let keychain: Map<string, string>;
let keychainLocked = false;

beforeEach(async () => {
  keychain = new Map();
  keychainLocked = false;
  setSecureStoreForTests({
    getItemAsync: async (key) => {
      if (keychainLocked) throw new Error("User interaction is not allowed.");
      return keychain.get(key) ?? null;
    },
    setItemAsync: async (key, value) => {
      if (keychainLocked) throw new Error("User interaction is not allowed.");
      keychain.set(key, value);
    },
  });
  await AsyncStorage.clear();
});

/** Deleting the app (or swapping TestFlight for the App Store build): AsyncStorage goes, the Keychain stays. */
const reinstall = () => AsyncStorage.clear();

describe("founding testers stay founding (11-H1)", () => {
  it("survives an empty boot (no firstLaunchAt yet) after the release", async () => {
    await syncFreeMonth(TESTER_START, TESTER_START + DAY, null); // before release: nothing decided
    await syncFreeMonth(null, RELEASE + DAY, RELEASE);
    expect(isFoundingMember()).toBe(true);
    expect(keychain.get("songnook.founding")).toBe("1");
  });

  it("survives deleting the app and installing the release build", async () => {
    await syncFreeMonth(TESTER_START, TESTER_START + DAY, null);
    await reinstall();
    // The fresh install's first sync runs before the library stamps a first launch.
    await syncFreeMonth(null, RELEASE + 2 * DAY, RELEASE);
    expect(isFoundingMember()).toBe(true);
  });

  it("covers a tester whose first launch since the free month shipped is after the release", async () => {
    await syncFreeMonth(TESTER_START, RELEASE + DAY, RELEASE);
    expect(isFoundingMember()).toBe(true);
  });

  it("never makes a new install founding, even after it restores a tester's backup", async () => {
    await syncFreeMonth(null, RELEASE + DAY, RELEASE); // fresh install
    expect(isFoundingMember()).toBe(false);
    // The restored backup brings a September firstLaunchAt.
    await syncFreeMonth(TESTER_START, RELEASE + 2 * DAY, RELEASE);
    expect(isFoundingMember()).toBe(false);
    expect(keychain.has("songnook.founding")).toBe(false);
  });

  it("writes nothing when the Keychain is locked (a launch in the background)", async () => {
    await syncFreeMonth(TESTER_START, TESTER_START + DAY, null);
    const before = new Map(keychain);
    keychainLocked = true;
    expect(await syncFreeMonth(null, RELEASE + DAY, RELEASE)).toBeNull();
    keychainLocked = false;
    expect(keychain).toEqual(before);
    await syncFreeMonth(null, RELEASE + 2 * DAY, RELEASE);
    expect(isFoundingMember()).toBe(true);
  });
});

describe("the free month survives one launch with the clock set ahead (07-M4)", () => {
  it("is open again when the date comes back", async () => {
    const start = Date.UTC(2026, 10, 1);
    await syncFreeMonth(start, start, null);
    const ahead = await syncFreeMonth(start, start + 40 * DAY, null);
    expect(ahead?.active).toBe(false);
    const back = await syncFreeMonth(start, start + 3 * DAY, null);
    expect(back?.active).toBe(true);
    expect(back?.daysLeft).toBe(27);
  });
});

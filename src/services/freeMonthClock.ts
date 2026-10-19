import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";
import { setPurchaseFreeAccess } from "../domain/entitlements";
import { freeMonthStatus, isFoundingInstall, type FreeMonthNotice, type FreeMonthStatus } from "../domain/freeMonth";

/**
 * Where the free month's start date lives (domain/freeMonth.ts). Deliberately NOT in the
 * app store snapshot: a backup must never carry access, and restoring an old backup must
 * not restart the month.
 *
 * The start date goes to the secure store first: on iOS that is the Keychain, which
 * outlives deleting the app, so a reinstall can't restart the month. Builds from before
 * expo-secure-store was added (2026-10-19) don't have its native side; they fall back to
 * AsyncStorage, which a reinstall clears. That is acceptable: nothing is charged by it.
 */

const START_KEY = "songnook.freeMonth.startedAt";
const NOTICES_KEY = "songnook.freeMonth.noticesShown";

type SecureStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
};

let secureStoreModule: SecureStore | null | undefined;

function secureStore(): SecureStore | null {
  if (secureStoreModule !== undefined) return secureStoreModule;
  // Ask whether the native side exists BEFORE loading the JS wrapper: on an older build
  // the wrapper's own load throws, and even a caught throw surfaces as a red error in dev.
  try {
    secureStoreModule = requireOptionalNativeModule("ExpoSecureStore")
      ? (require("expo-secure-store") as SecureStore)
      : null;
  } catch {
    secureStoreModule = null;
  }
  return secureStoreModule;
}

/** Secure-store keys allow only [A-Za-z0-9._-]; this one fits. */
const SECURE_START_KEY = START_KEY;

function parseTime(raw: string | null | undefined): number | null {
  const value = raw == null ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function readStart(): Promise<{ startedAt: number | null; inSecureStore: boolean }> {
  const secure = secureStore();
  if (secure) {
    const fromSecure = parseTime(await secure.getItemAsync(SECURE_START_KEY).catch(() => null));
    if (fromSecure) return { startedAt: fromSecure, inSecureStore: true };
  }
  return { startedAt: parseTime(await AsyncStorage.getItem(START_KEY).catch(() => null)), inSecureStore: false };
}

async function writeStart(startedAt: number): Promise<void> {
  const value = String(startedAt);
  await AsyncStorage.setItem(START_KEY, value).catch(() => {});
  await secureStore()?.setItemAsync(SECURE_START_KEY, value).catch(() => {});
}

let devStartOverride: number | null = null;

/**
 * Dev only: pretend the month started at `startedAt` (ms) to preview the notes and the
 * ended state; `null` returns to the stored date. Invoked from the debugger, like
 * setDevProOverride.
 */
export function setDevFreeMonthStart(startedAt: number | null) {
  if (!__DEV__) return;
  devStartOverride = startedAt;
}

/** Dev only: a preview start is set, so the notes show even while everything is free. */
export function isDevFreeMonthPreview(): boolean {
  return __DEV__ && devStartOverride != null;
}

/**
 * Read (or, on the very first launch, start) the free month and hand the result to the
 * entitlement gate. `firstLaunchAt` decides founding membership. Safe to call on every
 * foreground: the start date is written once and never moved.
 */
export async function syncFreeMonth(firstLaunchAt: number | null | undefined, now = Date.now()): Promise<FreeMonthStatus> {
  const stored = await readStart();
  let startedAt = stored.startedAt;
  if (startedAt == null || startedAt > now) {
    startedAt = now;
    await writeStart(startedAt);
  } else if (!stored.inSecureStore && secureStore()) {
    // An install upgraded onto a build with the secure store: copy the date into it once.
    await writeStart(startedAt);
  }
  const effectiveStart = __DEV__ && devStartOverride != null ? devStartOverride : startedAt;
  const status = freeMonthStatus(effectiveStart, now);
  setPurchaseFreeAccess({ freeMonthEndsAt: status.endsAt, founding: isFoundingInstall(firstLaunchAt) });
  return status;
}

export async function readShownNotices(): Promise<FreeMonthNotice[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTICES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is FreeMonthNotice => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function markNoticeShown(notice: FreeMonthNotice): Promise<void> {
  const shown = await readShownNotices();
  if (shown.includes(notice)) return;
  await AsyncStorage.setItem(NOTICES_KEY, JSON.stringify([...shown, notice])).catch(() => {});
}

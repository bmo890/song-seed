import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";
import { isPaywallLive, setPurchaseFreeAccess } from "../domain/entitlements";
import {
  decideFounding,
  freeMonthNow,
  freeMonthStart,
  freeMonthStatus,
  type FreeMonthNotice,
  type FreeMonthStatus,
} from "../domain/freeMonth";

/**
 * Where the free month's dates and the founding flag live (domain/freeMonth.ts).
 * Deliberately NOT in the app store snapshot: a backup must never carry access, and
 * restoring an old backup must not restart the month.
 *
 * Four values, all written to the secure store first: on iOS that is the Keychain,
 * which outlives deleting the app and "Erase everything", so neither restarts the
 * month nor drops a founding tester. Builds from before expo-secure-store was added
 * (2026-10-19) don't have its native side; they fall back to AsyncStorage, which a
 * reinstall clears. That is acceptable: nothing is charged by it.
 *
 *   startedAt       the install's first launch; written once, never moved.
 *   paywallSinceAt  the first launch of a build with the paywall live; the month is
 *                   counted from the later of the two (sweep P1-1).
 *   lastSeenAt      high-water mark of the clock; a date set back does not reopen
 *                   the month (sweep P2-2).
 *   founding        "1" or "0", decided once from `firstLaunchAt` and read from here
 *                   after that, so a restored backup cannot carry it (sweep P1-2).
 */

const START_KEY = "songnook.freeMonth.startedAt";
const PAYWALL_SINCE_KEY = "songnook.freeMonth.paywallSinceAt";
const LAST_SEEN_KEY = "songnook.freeMonth.lastSeenAt";
const FOUNDING_KEY = "songnook.founding";
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

function parseTime(raw: string | null | undefined): number | null {
  const value = raw == null ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Secure-store keys allow only [A-Za-z0-9._-]; all of ours fit, so one key serves both stores. */
async function readRaw(key: string): Promise<{ value: string | null; inSecureStore: boolean }> {
  const secure = secureStore();
  if (secure) {
    const fromSecure = await secure.getItemAsync(key).catch(() => null);
    if (fromSecure != null) return { value: fromSecure, inSecureStore: true };
  }
  return { value: await AsyncStorage.getItem(key).catch(() => null), inSecureStore: false };
}

async function writeRaw(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value).catch(() => {});
  await secureStore()?.setItemAsync(key, value).catch(() => {});
}

async function readTime(key: string): Promise<{ value: number | null; inSecureStore: boolean }> {
  const raw = await readRaw(key);
  const value = parseTime(raw.value);
  return { value, inSecureStore: value != null && raw.inSecureStore };
}

/**
 * Read a stored date, or write `fallback` when there is none. An install upgraded onto
 * a build with the secure store gets its AsyncStorage date copied into it once.
 */
async function readOrStartTime(key: string, fallback: number | null, clockNow: number): Promise<number | null> {
  const stored = await readTime(key);
  let value = stored.value;
  if (value == null || value > clockNow) {
    if (fallback == null) return null;
    value = fallback;
    await writeRaw(key, String(value));
  } else if (!stored.inSecureStore && secureStore()) {
    await writeRaw(key, String(value));
  }
  return value;
}

/** The founding flag ("1" / "0"), where it was found, and whether the read itself failed. */
async function readFoundingFlag(): Promise<{ value: string | null; inSecureStore: boolean; errored: boolean }> {
  const secure = secureStore();
  if (secure) {
    const fromSecure = await secure.getItemAsync(FOUNDING_KEY).catch(() => undefined);
    if (fromSecure === undefined) return { value: null, inSecureStore: false, errored: true };
    if (fromSecure !== null) return { value: fromSecure, inSecureStore: true, errored: false };
  }
  const mirrored = await AsyncStorage.getItem(FOUNDING_KEY).catch(() => undefined);
  if (mirrored === undefined) return { value: null, inSecureStore: false, errored: true };
  return { value: mirrored, inSecureStore: false, errored: false };
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
 * entitlement gate. `firstLaunchAt` feeds the one-time founding decision. Safe to call
 * on every foreground: the dates are written once and never moved; only the high-water
 * mark advances.
 */
export async function syncFreeMonth(firstLaunchAt: number | null | undefined, now = Date.now()): Promise<FreeMonthStatus> {
  // The clock a set-back date cannot move: read the high-water mark first, judge
  // everything by it, then raise it.
  const lastSeen = await readTime(LAST_SEEN_KEY);
  const clockNow = freeMonthNow(now, lastSeen.value);
  if (lastSeen.value == null || now > lastSeen.value || (!lastSeen.inSecureStore && secureStore())) {
    await writeRaw(LAST_SEEN_KEY, String(clockNow));
  }

  const startedAt = (await readOrStartTime(START_KEY, clockNow, clockNow)) ?? clockNow;
  // The month is counted from the first launch WITH a paywall: written once, the first
  // time a build with the paywall live runs. Nothing is written while everything is free.
  const paywallSinceAt = await readOrStartTime(PAYWALL_SINCE_KEY, isPaywallLive() ? clockNow : null, clockNow);

  // Founding: decided once, then read from the flag alone (the secure store first, so
  // "Erase everything" clearing the AsyncStorage mirror changes nothing).
  const flag = await readFoundingFlag();
  // A read that ERRORED (not one that found nothing) leaves the decision for next time
  // rather than storing "0" over a tester's "1".
  const decision = flag.errored ? { founding: false, store: null } : decideFounding(flag.value, firstLaunchAt);
  if (decision.store) await writeRaw(FOUNDING_KEY, decision.store);
  else if (flag.value != null && !flag.inSecureStore && secureStore()) await writeRaw(FOUNDING_KEY, flag.value);

  const effectiveStart = __DEV__ && devStartOverride != null ? devStartOverride : freeMonthStart(startedAt, paywallSinceAt);
  const status = freeMonthStatus(effectiveStart, clockNow);
  setPurchaseFreeAccess({ freeMonthEndsAt: status.endsAt, founding: decision.founding, seenAt: clockNow });
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

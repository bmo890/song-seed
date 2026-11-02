import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";
import { isPaywallLive, setPurchaseFreeAccess } from "../domain/entitlements";
import {
  APP_STORE_RELEASE_AT,
  advanceFreeMonthClock,
  decideFounding,
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
 * All written to the secure store first: on iOS that is the Keychain, which outlives
 * deleting the app and "Erase everything", so neither restarts the month nor drops a
 * founding tester. Builds from before expo-secure-store was added (2026-10-19) don't
 * have its native side; they fall back to AsyncStorage, which a reinstall clears.
 *
 *   startedAt       the install's first launch; written once, never moved.
 *   bornWith        the library's firstLaunchAt when startedAt was written ("none"
 *                   on a fresh install): founding evidence a backup can't carry.
 *   paywallSinceAt  the first launch of a build with the paywall live; the month is
 *                   counted from the later of the two (sweep P1-1).
 *   lastSeenAt      trusted high-water mark of the clock; a date set back does not
 *                   reopen the month (sweep P2-2).
 *   pendingAt       a big forward jump of the clock not yet confirmed (07-M4).
 *   founding        "1" once decided (11-H1); never "0".
 *
 * A secure-store read that FAILS (the Keychain is locked while the phone is, so a
 * launch in the background can't read it) is not "nothing stored": the sync then
 * writes nothing, so it can't restart the month or lose a founding record.
 */

const START_KEY = "songnook.freeMonth.startedAt";
const BORN_WITH_KEY = "songnook.freeMonth.bornWithFirstLaunchAt";
const PAYWALL_SINCE_KEY = "songnook.freeMonth.paywallSinceAt";
const LAST_SEEN_KEY = "songnook.freeMonth.lastSeenAt";
const PENDING_KEY = "songnook.freeMonth.clockJumpAt";
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

/** Tests only: use this secure store (or none) instead of the native one. */
export function setSecureStoreForTests(store: SecureStore | null) {
  secureStoreModule = store;
}

function parseTime(raw: string | null | undefined): number | null {
  const value = raw == null ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

type RawRead = { value: string | null; inSecureStore: boolean; errored: boolean };

/** Secure-store keys allow only [A-Za-z0-9._-]; all of ours fit, so one key serves both stores. */
async function readRaw(key: string): Promise<RawRead> {
  const secure = secureStore();
  if (secure) {
    const fromSecure = await secure.getItemAsync(key).catch(() => undefined);
    if (fromSecure === undefined) return { value: null, inSecureStore: false, errored: true };
    if (fromSecure != null) return { value: fromSecure, inSecureStore: true, errored: false };
  }
  const mirrored = await AsyncStorage.getItem(key).catch(() => undefined);
  if (mirrored === undefined) return { value: null, inSecureStore: false, errored: true };
  return { value: mirrored, inSecureStore: false, errored: false };
}

async function writeRaw(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value).catch(() => {});
  await secureStore()?.setItemAsync(key, value).catch(() => {});
}

/** The same durable store for other per-device allowances (services/sparkTries.ts). */
export const readDurable = (key: string) => readRaw(key).then((result) => result.value);
export const writeDurable = writeRaw;

type TimeRead = { value: number | null; inSecureStore: boolean; errored: boolean };

async function readTime(key: string): Promise<TimeRead> {
  const raw = await readRaw(key);
  const value = parseTime(raw.value);
  return { value, inSecureStore: value != null && raw.inSecureStore, errored: raw.errored };
}

/** Copy a value found only in AsyncStorage into the secure store, once. */
function needsSecureCopy(read: { value: unknown; inSecureStore: boolean }) {
  return read.value != null && !read.inSecureStore && !!secureStore();
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
 * entitlement gate. `firstLaunchAt` is the library's own first launch as hydrated. Safe
 * to call on every foreground: the dates are written once and never moved; only the
 * clock marks advance. Returns null, and changes nothing, when the store can't be read.
 */
export async function syncFreeMonth(
  firstLaunchAt: number | null | undefined,
  now = Date.now(),
  releaseAt: number | null = APP_STORE_RELEASE_AT
): Promise<FreeMonthStatus | null> {
  const [lastSeen, pending, started, bornWith, paywallSince, flag] = await Promise.all([
    readTime(LAST_SEEN_KEY),
    readTime(PENDING_KEY),
    readTime(START_KEY),
    readRaw(BORN_WITH_KEY),
    readTime(PAYWALL_SINCE_KEY),
    readRaw(FOUNDING_KEY),
  ]);
  if ([lastSeen, pending, started, bornWith, paywallSince, flag].some((read) => read.errored)) return null;

  const writes: Promise<void>[] = [];
  const write = (key: string, value: string) => writes.push(writeRaw(key, value));

  // The clock: a date set back cannot move it, and a big jump forward is not kept
  // until a later launch confirms it (07-M4).
  const clock = advanceFreeMonthClock(now, { lastSeenAt: lastSeen.value, pendingAt: pending.value });
  const clockNow = clock.judgeAt;
  if (clock.next.lastSeenAt != null && (clock.next.lastSeenAt !== lastSeen.value || needsSecureCopy(lastSeen))) {
    write(LAST_SEEN_KEY, String(clock.next.lastSeenAt));
  }
  if (clock.next.pendingAt !== pending.value) write(PENDING_KEY, clock.next.pendingAt == null ? "0" : String(clock.next.pendingAt));

  // The install's first launch: written once. A stored date later than the clock can
  // only come from a clock that has since gone back; it is rewritten.
  let startedAt = started.value;
  let firstLaunchAtAtBirth: number | null | undefined = parseTime(bornWith.value);
  if (startedAt == null || startedAt > clockNow) {
    startedAt = clockNow;
    firstLaunchAtAtBirth = parseTime(firstLaunchAt != null ? String(firstLaunchAt) : null);
    write(START_KEY, String(startedAt));
    write(BORN_WITH_KEY, firstLaunchAtAtBirth == null ? "none" : String(firstLaunchAtAtBirth));
  } else {
    if (needsSecureCopy(started)) write(START_KEY, String(startedAt));
    // A record born before this field: its date alone is the evidence.
    if (bornWith.value == null) firstLaunchAtAtBirth = undefined;
    else if (needsSecureCopy(bornWith)) write(BORN_WITH_KEY, bornWith.value);
  }

  // The month is counted from the first launch WITH a paywall: written once, the first
  // time a build with the paywall live runs. Nothing is written while everything is free.
  let paywallSinceAt = paywallSince.value;
  if (paywallSinceAt == null || paywallSinceAt > clockNow) {
    paywallSinceAt = isPaywallLive() ? clockNow : null;
    if (paywallSinceAt != null) write(PAYWALL_SINCE_KEY, String(paywallSinceAt));
  } else if (needsSecureCopy(paywallSince)) {
    write(PAYWALL_SINCE_KEY, String(paywallSinceAt));
  }

  // Founding (11-H1): from records no backup carries; "1" once, never "0".
  const decision = decideFounding(flag.value, { startedAt, firstLaunchAtAtBirth }, releaseAt);
  if (decision.store) write(FOUNDING_KEY, decision.store);
  else if (flag.value === "1" && needsSecureCopy(flag)) write(FOUNDING_KEY, flag.value);

  await Promise.all(writes);

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

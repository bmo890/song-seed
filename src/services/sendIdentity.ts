/**
 * How this install names itself to SongNook Send (founder, 2026-11-01). No
 * accounts: the app keeps one random send key in the durable store (the
 * Keychain on iOS, so a reinstall keeps it) and sends it with every sealed
 * link and pairing call. The server knows only its hash. With it go two
 * claims the server checks for itself: RevenueCat's id for this install (the
 * server asks RevenueCat whether it has Pro) and the free month's end (the
 * server clamps it to a month after it first saw the key).
 */
import * as Crypto from "expo-crypto";
import { getFreeMonthEndsAt } from "../domain/entitlements";
import { getBillingAppUserId } from "./billing";
import { readDurable, writeDurable } from "./freeMonthClock";

const SEND_KEY = "songnook.send.key";

let cached: string | null = null;

function newKey(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = Crypto.getRandomBytes(32);
  return `sk_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** This install's send key, made on first use. */
export async function getSendKey(): Promise<string> {
  if (cached) return cached;
  const stored = await readDurable(SEND_KEY).catch(() => null);
  if (stored && /^[A-Za-z0-9_-]{20,200}$/.test(stored)) {
    cached = stored;
    return stored;
  }
  const key = newKey();
  await writeDurable(SEND_KEY, key);
  cached = key;
  return key;
}

/** Headers that name this install to the Send server. */
export async function sendIdentityHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "x-songnook-sender": await getSendKey() };
  const rc = await getBillingAppUserId();
  if (rc) headers["x-songnook-rc"] = rc;
  const trialEnds = getFreeMonthEndsAt();
  if (trialEnds != null) headers["x-songnook-trial-ends"] = String(trialEnds);
  return headers;
}

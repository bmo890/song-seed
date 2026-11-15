import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { SEND_SERVICE_BASE_URL } from "../config/sendService";
import { i18n } from "../i18n/instance";

/** Mirrors the server's bounds (server/songnook-send/src/lib/feedback.ts). */
export const FEEDBACK_NOTE_MIN = 3;
export const FEEDBACK_NOTE_MAX = 2000;
export const FEEDBACK_EMAIL_MAX = 254;

/** The server's own test (parseReplyTo): one @, a dot in the domain, nothing else odd. */
const EMAIL = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]+$/;

/** Empty is fine (an anonymous note); anything typed must read as an address. */
export function feedbackEmailOk(email: string): boolean {
  const value = email.trim();
  return value === "" || (value.length <= FEEDBACK_EMAIL_MAX && EMAIL.test(value));
}

const FEEDBACK_TIMEOUT_MS = 15_000;

/**
 * Post a note from the feedback sheet. It travels with what a bug report needs
 * (app version, installed update, system, language) and nothing that says who
 * wrote it: no name, no send key, no device id. An email goes only when the person
 * typed one to be answered at. Rejects when it didn't land.
 */
export async function sendFeedbackNote(note: string, email = ""): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEEDBACK_TIMEOUT_MS);
  try {
    const res = await fetch(`${SEND_SERVICE_BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        note: note.trim(),
        version: Constants.expoConfig?.version ?? "",
        // The short id the About page shows; nothing on the binary's own bundle.
        update: Updates.isEmbeddedLaunch || !Updates.updateId ? "" : Updates.updateId.replace(/-/g, "").slice(0, 6),
        platform: `${Platform.OS} ${Platform.Version}`,
        locale: i18n.language ?? "",
        ...(email.trim() ? { email: email.trim() } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Feedback refused (${res.status}).`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Notes from the app's feedback sheet (founder, 2026-11-11): a person types a
 * note and it lands here, with no mail app and no account. The row holds the
 * note and which build it came from — never a name, a send key or an IP — so
 * nobody can be answered and nobody can be followed.
 */
import type { Env } from "../env";

export const FEEDBACK_NOTE_MIN = 3;
export const FEEDBACK_NOTE_MAX = 2000;
/** A note is read for a year, then the nightly sweep drops it. */
export const FEEDBACK_KEEP_MS = 365 * 24 * 60 * 60 * 1000;

export type FeedbackNote = {
  note: string;
  appVersion: string;
  appUpdate: string;
  platform: string;
  locale: string;
};

export type FeedbackParse = { ok: true; value: FeedbackNote } | { ok: false; error: string };

/** A short label: one line, printable, capped. Anything else reads as empty. */
function label(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

export function parseFeedback(body: Record<string, unknown>): FeedbackParse {
  if (typeof body.note !== "string") return { ok: false, error: "note required" };
  // Keep line breaks; drop the other control characters.
  const note = body.note.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (note.length < FEEDBACK_NOTE_MIN) return { ok: false, error: "note too short" };
  if (note.length > FEEDBACK_NOTE_MAX) return { ok: false, error: "note too long" };
  return {
    ok: true,
    value: {
      note,
      appVersion: label(body.version, 24),
      appUpdate: label(body.update, 40),
      platform: label(body.platform, 40),
      locale: label(body.locale, 16),
    },
  };
}

export async function insertFeedback(env: Env, value: FeedbackNote, now: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO feedback (feedback_id, created_at, note, app_version, app_update, platform, locale)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(`f_${crypto.randomUUID()}`, now, value.note, value.appVersion, value.appUpdate, value.platform, value.locale)
    .run();
}

/**
 * The email the founder gets for each note (2026-11-14: "receive an email whenever one
 * is sent"). The same fields the row holds, nothing more: it can't say who wrote it.
 */
export function feedbackEmail(value: FeedbackNote, now: number): { subject: string; text: string } {
  const firstLine = value.note.split("\n")[0].slice(0, 60);
  const lines = [
    value.note,
    "",
    "—",
    `App ${value.appVersion || "?"}${value.appUpdate ? ` (update ${value.appUpdate})` : ""}`,
    `Phone ${value.platform || "?"} · language ${value.locale || "?"}`,
    `Sent ${new Date(now).toISOString().replace("T", " ").slice(0, 16)} UTC`,
    "",
    "Anonymous: there is no address to reply to.",
  ];
  return { subject: `SongNook feedback: ${firstLine}${value.note.length > 60 ? "…" : ""}`, text: lines.join("\n") };
}

/** UTF-8 text as base64, in 76-character lines (a note may be in Hebrew). */
function base64Utf8(text: string, wrap = 0): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  const encoded = btoa(binary);
  return wrap ? (encoded.match(new RegExp(`.{1,${wrap}}`, "g")) ?? [""]).join("\r\n") : encoded;
}

/**
 * The whole message, as Email Routing's send() wants it: plain text, UTF-8, base64.
 * Pure, so it is tested without the Workers runtime.
 */
export function feedbackMime(value: FeedbackNote, now: number, from: string, to: string, messageId: string): string {
  const { subject, text } = feedbackEmail(value, now);
  return [
    `From: "SongNook feedback" <${from}>`,
    `To: <${to}>`,
    `Subject: =?UTF-8?B?${base64Utf8(subject)}?=`,
    `Date: ${new Date(now).toUTCString()}`,
    `Message-ID: <${messageId}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Utf8(text, 76),
  ].join("\r\n");
}

/** Builds the runtime's EmailMessage; injected so this file stays free of `cloudflare:email`. */
export type MakeEmail = (from: string, to: string, raw: string) => unknown;

/**
 * Email a note to the founder through Cloudflare Email Routing: free, and only to the
 * verified address the binding names (founder, 2026-11-14: no paid plan). Never throws:
 * the note is already saved.
 */
export async function notifyFeedback(env: Env, value: FeedbackNote, now: number, makeEmail: MakeEmail): Promise<void> {
  const to = env.FEEDBACK_NOTIFY_TO;
  const from = env.FEEDBACK_NOTIFY_FROM;
  if (!env.EMAIL || !to || !from) return;
  try {
    const raw = feedbackMime(value, now, from, to, `${crypto.randomUUID()}@songnook.app`);
    await env.EMAIL.send(makeEmail(from, to, raw));
  } catch (error) {
    console.warn("feedback email failed", error);
  }
}

export async function sweepFeedback(env: Env, now: number): Promise<void> {
  await env.DB.prepare(`DELETE FROM feedback WHERE created_at < ?`).bind(now - FEEDBACK_KEEP_MS).run();
}

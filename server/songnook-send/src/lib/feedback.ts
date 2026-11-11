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

export async function sweepFeedback(env: Env, now: number): Promise<void> {
  await env.DB.prepare(`DELETE FROM feedback WHERE created_at < ?`).bind(now - FEEDBACK_KEEP_MS).run();
}

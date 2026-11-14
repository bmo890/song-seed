import { test } from "node:test";
import assert from "node:assert/strict";
import { FEEDBACK_KEEP_MS, FEEDBACK_NOTE_MAX, feedbackEmail, feedbackMime, insertFeedback, notifyFeedback, parseFeedback, sweepFeedback } from "../feedback.ts";

test("a note is trimmed and keeps its line breaks", () => {
  const parsed = parseFeedback({ note: "  The loop skips.\n\nSecond line\u0007  ", version: "1.0.0" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.note, "The loop skips.\n\nSecond line");
  assert.equal(parsed.value.appVersion, "1.0.0");
});

test("a missing, empty or over-long note is refused", () => {
  assert.deepEqual(parseFeedback({}), { ok: false, error: "note required" });
  assert.deepEqual(parseFeedback({ note: 42 }), { ok: false, error: "note required" });
  assert.deepEqual(parseFeedback({ note: "  a \n " }), { ok: false, error: "note too short" });
  assert.deepEqual(parseFeedback({ note: "x".repeat(FEEDBACK_NOTE_MAX + 1) }), { ok: false, error: "note too long" });
  assert.equal(parseFeedback({ note: "x".repeat(FEEDBACK_NOTE_MAX) }).ok, true);
});

test("the labels are one line, capped, and empty when they are not text", () => {
  const parsed = parseFeedback({
    note: "Add a capo field",
    version: "1.0.0\n<script>",
    update: "u".repeat(200),
    platform: { os: "ios" },
    locale: " he ",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.appVersion, "1.0.0 <script>");
  assert.equal(parsed.value.appUpdate.length, 40);
  assert.equal(parsed.value.platform, "");
  assert.equal(parsed.value.locale, "he");
});

const fakeDb = () => {
  const calls: { sql: string; args: unknown[] }[] = [];
  return {
    calls,
    env: {
      DB: {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async run() {
                  calls.push({ sql, args });
                },
              };
            },
          };
        },
      },
    } as any,
  };
};

test("a stored note carries no key and no address: only the note and its build", async () => {
  const db = fakeDb();
  await insertFeedback(
    db.env,
    { note: "Hello", appVersion: "1.0.0", appUpdate: "abc", platform: "ios 18.5", locale: "en" },
    1000
  );
  assert.equal(db.calls.length, 1);
  const [id, createdAt, ...rest] = db.calls[0].args;
  assert.match(String(id), /^f_[0-9a-f-]{36}$/);
  assert.equal(createdAt, 1000);
  assert.deepEqual(rest, ["Hello", "1.0.0", "abc", "ios 18.5", "en"]);
});

test("the sweep drops notes older than a year", async () => {
  const db = fakeDb();
  const now = 5 * FEEDBACK_KEEP_MS;
  await sweepFeedback(db.env, now);
  assert.match(db.calls[0].sql, /DELETE FROM feedback WHERE created_at < \?/);
  assert.deepEqual(db.calls[0].args, [now - FEEDBACK_KEEP_MS]);
});

test("the founder's email carries the note and its build, and nothing about the writer", () => {
  const value = { note: "The loop skips\nafter a pause", appVersion: "1.0.0", appUpdate: "01a1d3", platform: "ios 26.6", locale: "en" };
  const mail = feedbackEmail(value, Date.UTC(2026, 10, 14, 17, 0));
  assert.equal(mail.subject, "SongNook feedback: The loop skips");
  assert.match(mail.text, /^The loop skips\nafter a pause\n/);
  assert.match(mail.text, /App 1\.0\.0 \(update 01a1d3\)/);
  assert.match(mail.text, /Phone ios 26\.6 · language en/);
  assert.match(mail.text, /Sent 2026-11-14 17:00 UTC/);
  assert.equal(feedbackEmail({ ...value, note: "x".repeat(80) }, 0).subject.endsWith("…"), true);
});

test("the message is plain UTF-8 text a mail client can read, Hebrew included", () => {
  const value = { note: "שלום, the loop skips", appVersion: "1.0.0", appUpdate: "", platform: "ios 26", locale: "he" };
  const raw = feedbackMime(value, Date.UTC(2026, 10, 14), "feedback@songnook.app", "founder@example.com", "abc@songnook.app");
  const [head, body] = raw.split("\r\n\r\n");
  assert.match(head, /^From: "SongNook feedback" <feedback@songnook\.app>\r\nTo: <founder@example\.com>\r\n/);
  assert.match(head, /Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
  assert.match(head, /Message-ID: <abc@songnook\.app>/);
  assert.match(head, /Content-Type: text\/plain; charset=UTF-8/);
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\r\n/g, "")), (ch) => ch.charCodeAt(0)));
  assert.match(decoded, /^שלום, the loop skips\n/);
  assert.ok(body.split("\r\n").every((line) => line.length <= 76));
});

test("a note is mailed when the binding is set, skipped when not, and a failed mail never throws", async () => {
  const sent: { from: string; to: string; raw: string }[] = [];
  const make = (from: string, to: string, raw: string) => ({ from, to, raw });
  const value = { note: "Hello there", appVersion: "1.0.0", appUpdate: "", platform: "android 37", locale: "en" };
  const env = {
    EMAIL: { send: async (m: { from: string; to: string; raw: string }) => { sent.push(m); return {}; } },
    FEEDBACK_NOTIFY_TO: "founder@example.com",
    FEEDBACK_NOTIFY_FROM: "feedback@songnook.app",
  } as never;
  await notifyFeedback(env, value, 0, make);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "founder@example.com");
  assert.equal(sent[0].from, "feedback@songnook.app");

  await notifyFeedback({ FEEDBACK_NOTIFY_TO: "a@b.c", FEEDBACK_NOTIFY_FROM: "d@e.f" } as never, value, 0, make);
  assert.equal(sent.length, 1);

  const failing = { ...(env as object), EMAIL: { send: async () => { throw new Error("not verified"); } } } as never;
  await notifyFeedback(failing, value, 0, make);
});

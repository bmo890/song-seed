import { test } from "node:test";
import assert from "node:assert/strict";
import { FEEDBACK_KEEP_MS, FEEDBACK_NOTE_MAX, insertFeedback, parseFeedback, sweepFeedback } from "../feedback.ts";

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

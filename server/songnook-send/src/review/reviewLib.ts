/**
 * Translation review (founder, 2026-11-20): a native translator goes over the app's
 * Hebrew, line by line, at songnook.app/review/he/<link>. The lines come from the app's
 * own catalog (heSheet.generated.ts, built by scripts/i18n/he-review/build.mjs); his
 * edits live in D1 (review_edits, every save also in review_history) and are copied to
 * R2 each night. Nothing here touches the app: the edits are pulled back into
 * src/i18n/locales/he.ts by scripts/i18n/he-review/apply.mjs.
 */
import { HE_SHEET } from "./heSheet.generated.ts";

export type ReviewForm = { form: string; en: string; he: string };
export type ReviewItem = {
  id: string;
  keys: readonly string[];
  section: string;
  page: string;
  kind: string;
  forms: readonly ReviewForm[];
  where: readonly string[];
  otherHebrew: readonly string[];
};
export type ReviewTerm = { id: string; term: string; meaning: string; he: string };

export type ReviewEdit = {
  item_id: string;
  forms: string; // JSON {form: text}
  note: string;
  status: string;
  updated_at: number;
};

export const REVIEW_ID = "he";
const SHEET = HE_SHEET as unknown as {
  builtAt: string;
  counts: Record<string, number>;
  terms: ReviewTerm[];
  items: ReviewItem[];
};
export const sheet = SHEET;
const KNOWN_IDS = new Set<string>([...SHEET.items.map((i) => i.id), ...SHEET.terms.map((t) => t.id)]);

/** The link's token, checked against the SHA-256 kept in wrangler.toml (the token itself
 *  is never stored). Constant-time over the hex digests. */
export async function tokenMatches(token: string, expectedSha256Hex: string | undefined): Promise<boolean> {
  if (!expectedSha256Hex || !token || token.length < 16 || token.length > 128) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const want = expectedSha256Hex.trim().toLowerCase();
  if (hex.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

const MAX_TEXT = 2000;
const MAX_NOTE = 4000;
const STATUSES = new Set(["", "ok", "changed"]);

/** A save from the page, checked: a known line, short strings, a known status. */
export function parseSave(body: unknown): { itemId: string; forms: Record<string, string>; note: string; status: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const itemId = typeof b.itemId === "string" ? b.itemId : "";
  if (!KNOWN_IDS.has(itemId)) return null;
  const formsIn = b.forms && typeof b.forms === "object" ? (b.forms as Record<string, unknown>) : {};
  const forms: Record<string, string> = {};
  for (const [form, text] of Object.entries(formsIn)) {
    if (!/^(|zero|one|two|few|many|other)$/.test(form)) return null;
    if (typeof text !== "string" || text.length > MAX_TEXT) return null;
    if (text.trim()) forms[form] = text;
  }
  const note = typeof b.note === "string" ? b.note.slice(0, MAX_NOTE) : "";
  const status = typeof b.status === "string" && STATUSES.has(b.status) ? b.status : "";
  return { itemId, forms, note, status };
}

/** `{{tokens}}` (the app) and `{tokens}` (the web pages) a line must keep. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g)].map((m) => m[1] ?? m[2]).sort();
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The whole review as a spreadsheet: one row per Hebrew form, lines numbered as on the
 *  page. A byte-order mark first, so Excel opens the Hebrew as Hebrew. */
export function toCsv(edits: Map<string, ReviewEdit>): string {
  const rows: string[][] = [
    ["Line", "Section", "Page", "Kind", "Form", "English", "Current Hebrew", "New Hebrew", "Note", "Status", "Places", "Keys", "Saved"],
  ];
  SHEET.terms.forEach((term, i) => {
    const edit = edits.get(term.id);
    const forms = edit ? (JSON.parse(edit.forms) as Record<string, string>) : {};
    rows.push([
      `T${i + 1}`, "Key terms", "", "Term", "", term.term, term.he, forms[""] ?? "", edit?.note ?? "", edit?.status ?? "", "", "",
      edit ? new Date(edit.updated_at).toISOString() : "",
    ]);
  });
  SHEET.items.forEach((item, i) => {
    const edit = edits.get(item.id);
    const forms = edit ? (JSON.parse(edit.forms) as Record<string, string>) : {};
    item.forms.forEach((f, fi) => {
      rows.push([
        String(i + 1), item.section, item.page, item.kind, f.form, f.en, f.he, forms[f.form] ?? "",
        fi === 0 ? edit?.note ?? "" : "", fi === 0 ? edit?.status ?? "" : "", String(item.keys.length),
        item.keys.join(" "), edit && fi === 0 ? new Date(edit.updated_at).toISOString() : "",
      ]);
    });
  });
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** The edits with their lines, for the app's apply script and for safekeeping. */
export function toJson(edits: Map<string, ReviewEdit>): string {
  const lines = [...SHEET.terms.map((t) => ({ id: t.id, keys: [] as readonly string[], forms: [{ form: "", en: t.term, he: t.he }] })), ...SHEET.items]
    .filter((item) => edits.has(item.id))
    .map((item) => {
      const edit = edits.get(item.id)!;
      const forms = JSON.parse(edit.forms) as Record<string, string>;
      return {
        id: item.id,
        keys: item.keys,
        forms: item.forms.map((f) => ({ form: f.form, en: f.en, he: f.he, new: forms[f.form] ?? "" })),
        note: edit.note,
        status: edit.status,
        updatedAt: new Date(edit.updated_at).toISOString(),
      };
    });
  return JSON.stringify({ review: REVIEW_ID, sheetBuiltAt: SHEET.builtAt, exportedAt: new Date().toISOString(), lines }, null, 2);
}

export async function readEdits(db: D1Database): Promise<Map<string, ReviewEdit>> {
  const { results } = await db
    .prepare("SELECT item_id, forms, note, status, updated_at FROM review_edits WHERE review = ?")
    .bind(REVIEW_ID)
    .all<ReviewEdit>();
  return new Map((results ?? []).map((row) => [row.item_id, row]));
}

export async function writeEdit(
  db: D1Database,
  save: { itemId: string; forms: Record<string, string>; note: string; status: string },
  now: number
): Promise<void> {
  const forms = JSON.stringify(save.forms);
  await db.batch([
    db
      .prepare(
        `INSERT INTO review_edits (review, item_id, forms, note, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(review, item_id) DO UPDATE SET forms = excluded.forms, note = excluded.note, status = excluded.status, updated_at = excluded.updated_at`
      )
      .bind(REVIEW_ID, save.itemId, forms, save.note, save.status, now),
    db
      .prepare("INSERT INTO review_history (review, item_id, forms, note, status, saved_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(REVIEW_ID, save.itemId, forms, save.note, save.status, now),
  ]);
}

/** The night's copy to R2: the edits as JSON, one file per day, kept. */
export async function backupToR2(db: D1Database, bucket: R2Bucket, now: number): Promise<number> {
  const edits = await readEdits(db);
  if (edits.size === 0) return 0;
  const day = new Date(now).toISOString().slice(0, 10);
  await bucket.put(`review-backups/${REVIEW_ID}/${day}.json`, toJson(edits), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return edits.size;
}

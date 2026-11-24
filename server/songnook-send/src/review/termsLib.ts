/**
 * The Hebrew TERMS review (founder, 2026-11-24): the recurring words a native musician
 * checks, one row each, at songnook.app/review/he-terms/<link>. Kept apart from the full
 * line-by-line review (reviewLib.ts): its own sheet (heTerms.generated.ts, built by
 * scripts/i18n/he-review/terms.mjs), its own link, its own rows in the same D1 tables
 * (review = "he-terms"), its own nightly copy in R2.
 */
import { HE_TERMS } from "./heTerms.generated.ts";

export const TERMS_REVIEW_ID = "he-terms";

export type TermRow = {
  id: string;
  group: string;
  en: string;
  meaning: string;
  he: string;
  alsoHe: readonly string[];
  uses: number;
  /** Where the word itself shows ("Player, Recorder · title"). */
  seen: string | null;
  example: { key: string; en: string; he: string; where: string | null } | null;
};
export type TermSentence = { id: string; key: string; en: string; he: string; where: string | null };
export type TermGroup = { id: string; title: string; lede: string };

const SHEET = HE_TERMS as unknown as { builtAt: string; groups: TermGroup[]; rows: TermRow[]; sentences: TermSentence[] };
export const termsSheet = SHEET;
const KNOWN = new Set<string>([...SHEET.rows.map((r) => r.id), ...SHEET.sentences.map((s) => s.id)]);

export type TermEdit = { item_id: string; forms: string; note: string; status: string; updated_at: number };

const MAX_TEXT = 2000;
const MAX_NOTE = 4000;
const STATUSES = new Set(["", "ok", "changed"]);

/** A save from the page: a known row, his word (or sentence), a note, a status. */
export function parseTermSave(body: unknown): { itemId: string; text: string; note: string; status: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const itemId = typeof b.itemId === "string" ? b.itemId : "";
  if (!KNOWN.has(itemId)) return null;
  const text = typeof b.text === "string" ? b.text : "";
  if (text.length > MAX_TEXT) return null;
  const note = typeof b.note === "string" ? b.note.slice(0, MAX_NOTE) : "";
  const status = typeof b.status === "string" && STATUSES.has(b.status) ? b.status : "";
  return { itemId, text: text.trim(), note, status };
}

export async function readTermEdits(db: D1Database): Promise<Map<string, TermEdit>> {
  const { results } = await db
    .prepare("SELECT item_id, forms, note, status, updated_at FROM review_edits WHERE review = ?")
    .bind(TERMS_REVIEW_ID)
    .all<TermEdit>();
  return new Map((results ?? []).map((row) => [row.item_id, row]));
}

export async function writeTermEdit(
  db: D1Database,
  save: { itemId: string; text: string; note: string; status: string },
  now: number
): Promise<void> {
  const forms = JSON.stringify(save.text ? { "": save.text } : {});
  await db.batch([
    db
      .prepare(
        `INSERT INTO review_edits (review, item_id, forms, note, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(review, item_id) DO UPDATE SET forms = excluded.forms, note = excluded.note, status = excluded.status, updated_at = excluded.updated_at`
      )
      .bind(TERMS_REVIEW_ID, save.itemId, forms, save.note, save.status, now),
    db
      .prepare("INSERT INTO review_history (review, item_id, forms, note, status, saved_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(TERMS_REVIEW_ID, save.itemId, forms, save.note, save.status, now),
  ]);
}

const textOf = (edit: TermEdit | undefined) => (edit ? (JSON.parse(edit.forms) as Record<string, string>)[""] ?? "" : "");

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** One spreadsheet row per word, then per sentence. A byte-order mark so Excel reads Hebrew. */
export function termsCsv(edits: Map<string, TermEdit>): string {
  const groupTitle = new Map(SHEET.groups.map((g) => [g.id, g.title]));
  const rows: string[][] = [["#", "Group", "English", "Meaning", "Hebrew now", "His Hebrew", "Fine as is", "Note", "Used in", "Saved"]];
  SHEET.rows.forEach((r, i) => {
    const e = edits.get(r.id);
    rows.push([
      String(i + 1), groupTitle.get(r.group) ?? r.group, r.en, r.meaning, r.he, textOf(e), e?.status === "ok" ? "yes" : "",
      e?.note ?? "", String(r.uses), e ? new Date(e.updated_at).toISOString() : "",
    ]);
  });
  SHEET.sentences.forEach((s, i) => {
    const e = edits.get(s.id);
    rows.push([
      `S${i + 1}`, "Sentences", s.en, "", s.he, textOf(e), e?.status === "ok" ? "yes" : "", e?.note ?? "", "",
      e ? new Date(e.updated_at).toISOString() : "",
    ]);
  });
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Everything he answered, for applying to the app and for safekeeping. */
export function termsJson(edits: Map<string, TermEdit>): string {
  const words = SHEET.rows
    .filter((r) => edits.has(r.id))
    .map((r) => {
      const e = edits.get(r.id)!;
      return { id: r.id, en: r.en, he: r.he, new: textOf(e), note: e.note, status: e.status, updatedAt: new Date(e.updated_at).toISOString() };
    });
  const sentences = SHEET.sentences
    .filter((s) => edits.has(s.id))
    .map((s) => {
      const e = edits.get(s.id)!;
      return { id: s.id, key: s.key, en: s.en, he: s.he, new: textOf(e), note: e.note, status: e.status, updatedAt: new Date(e.updated_at).toISOString() };
    });
  return JSON.stringify({ review: TERMS_REVIEW_ID, sheetBuiltAt: SHEET.builtAt, exportedAt: new Date().toISOString(), words, sentences }, null, 2);
}

/** The night's copy to R2, as for the full review. */
export async function backupTermsToR2(db: D1Database, bucket: R2Bucket, now: number): Promise<number> {
  const edits = await readTermEdits(db);
  if (edits.size === 0) return 0;
  const day = new Date(now).toISOString().slice(0, 10);
  await bucket.put(`review-backups/${TERMS_REVIEW_ID}/${day}.json`, termsJson(edits), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return edits.size;
}

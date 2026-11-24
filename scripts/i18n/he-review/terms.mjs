// Builds the Hebrew TERMS sheet (founder, 2026-11-24): the recurring words a native
// musician checks, one row each, separate from the full line-by-line sheet.
//
//   node scripts/i18n/he-review/terms.mjs            writes the sheet the worker serves
//   node scripts/i18n/he-review/terms.mjs --print    prints the draft list, writes nothing
//
// For every word in terms.list.mjs it finds, from the app's own catalogs:
// - the current Hebrew: what the app shows where that word stands alone as a label
//   (most common first; a second rendering is listed, since inconsistency is a finding);
// - how many lines use the word;
// - one real sentence that uses it, in Hebrew with its English, to hear it in context.
// Writes server/songnook-send/src/review/heTerms.generated.ts.
import fs from "node:fs";
import path from "node:path";
import { ROOT, readCatalog, leaves } from "../catalog.mjs";
import { GROUPS, TERMS, SENTENCE_KEYS } from "./terms.list.mjs";

const PLURAL = /_(zero|one|two|few|many|other)$/;
const en = Object.fromEntries(leaves(readCatalog("en")));
const he = Object.fromEntries(leaves(readCatalog("he")));
const unusedFile = path.join(ROOT, "scripts/i18n/he-review/unused-keys.txt");
const unused = new Set(
  fs.existsSync(unusedFile) ? fs.readFileSync(unusedFile, "utf8").split("\n").map((l) => l.trim().split(/\s+/)[0]).filter(Boolean) : []
);

// One entry per base key: English (singular-ish) + Hebrew (the "other"/plain form).
const lines = new Map();
for (const [key, value] of Object.entries(en)) {
  const base = key.replace(PLURAL, "");
  if (unused.has(base) || unused.has(key)) continue;
  if (!(key in he)) continue;
  const prev = lines.get(base);
  const isPlain = !PLURAL.test(key) || /_other$/.test(key);
  if (!prev || isPlain) lines.set(base, { key: base, en: value, he: he[key] });
}
const all = [...lines.values()];

// Where each line really shows in the app, from the full sheet (build.mjs reads the code):
// a key that is not there is never shown, so it is never an example.
const sheetFile = path.join(ROOT, "server/songnook-send/src/review/heSheet.generated.ts");
const sheetSrc = fs.readFileSync(sheetFile, "utf8");
const SHEET = JSON.parse(sheetSrc.slice(sheetSrc.indexOf("{"), sheetSrc.lastIndexOf("}") + 1));
const SHARED = "Shared across the app";
/** The screen folder a file sits in ("PlayerScreen"), or null for shared code. */
const folderOf = (file) => (/^[A-Za-z]+Screen\//.test(file) ? file.split("/")[0] : null);
// A line used across the app names no page; the screens it is used in do. Learn each
// screen folder's page from the lines there that name one (the most common wins).
const votes = new Map();
for (const item of SHEET.items) {
  if (item.page === SHARED) continue;
  for (const folder of new Set((item.where ?? []).map(folderOf).filter(Boolean))) {
    const tally = votes.get(folder) ?? new Map();
    tally.set(item.page, (tally.get(item.page) ?? 0) + 1);
    votes.set(folder, tally);
  }
}
const folderPage = new Map([...votes].map(([folder, tally]) => [folder, [...tally].sort((x, y) => y[1] - x[1])[0][0]]));
const shownAt = new Map();
for (const item of SHEET.items) {
  const pages = item.page !== SHARED ? [item.page] : [...new Set((item.where ?? []).map((f) => folderPage.get(folderOf(f))).filter(Boolean))];
  for (const k of item.keys) shownAt.set(k.replace(PLURAL, ""), { pages, kind: item.kind });
}
// "On screen" tells a reader nothing; the other kinds do.
const KIND_WORD = { Title: "title", Button: "button", Menu: "menu", "Pop-up": "pop-up", Message: "message", "Empty screen": "empty screen", Placeholder: "placeholder" };
/** "Player, Sketch · pop-up": where a person meets these lines (pages, then kinds). */
function placesOf(keys) {
  const ats = keys.map((k) => shownAt.get(k.replace(PLURAL, ""))).filter(Boolean);
  const pages = [...new Set(ats.flatMap((at) => at.pages))];
  const kinds = [...new Set(ats.map((at) => KIND_WORD[at.kind]).filter(Boolean))];
  const pageText = pages.length > 3 ? `${pages.slice(0, 3).join(", ")} and more` : pages.join(", ");
  return [pageText, kinds.slice(0, 2).join(", ")].filter(Boolean).join(" · ") || null;
}
const whereOf = (key) => placesOf([key]);
const visible = (key) => {
  const at = shownAt.get(key.replace(PLURAL, ""));
  return !!at && at.kind !== "Screen reader";
};
const PROBLEMS = [];
const asExample = (l) => ({ key: l.key, en: l.en, he: l.he, where: whereOf(l.key) });

const clean = (s) => s.replace(/\{\{[^}]+\}\}/g, "").replace(/[\s:·…?!.]+$/g, "").replace(/\s+/g, " ").trim();
const norm = (s) => s.replace(/\{\{[^}]+\}\}/g, "").replace(/[.…:?!·"“”'’]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w) => new RegExp(`(^|[^A-Za-z])${escape(w)}(s|es)?($|[^A-Za-z])`, "i");

function pinned(term) {
  const base = (k) => k.replace(PLURAL, "");
  const found = (term.keys ?? []).map((k) => ({ key: base(k), en: en[k] ?? lines.get(base(k))?.en, he: he[k] ?? lines.get(base(k))?.he })).filter((l) => l.en && l.he);
  for (const l of found) if (!visible(l.key)) PROBLEMS.push(`"${term.en}": pinned line ${l.key} is not shown in the app`);
  if (!found.length) throw new Error(`no catalog line for pinned keys of "${term.en}"`);
  const head = found[0];
  const isSentence = (l) => l.en.split(/\s+/).length >= 3;
  const example = term.he && isSentence(head) ? head : found.find((l, i) => i > 0 && isSentence(l)) ?? (isSentence(head) ? head : null);
  const current = term.he ?? clean(head.he);
  // Other short labels pinned for the word: the other Hebrew the app uses for it.
  const also = [...new Set(found.slice(1).filter((l) => !isSentence(l)).map((l) => clean(l.he)))].filter((h) => h && h !== current);
  return {
    id: `term:${term.en.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    group: term.group,
    en: term.en,
    meaning: term.meaning ?? "",
    he: current,
    alsoHe: also.slice(0, 3),
    uses: all.filter((l) => visible(l.key) && wordRe(term.en.replace(/ \(.*\)$/, "")).test(l.en)).length,
    seen: placesOf(found.filter((l) => !isSentence(l) || l === head).map((l) => l.key)),
    example: example ? asExample(example) : null,
  };
}

function build(term) {
  if (term.keys) return pinned(term);
  const labels = [term.en, ...(term.labels ?? [])].map(norm);
  const exact = all.filter((l) => visible(l.key) && labels.includes(norm(l.en)));
  const tally = new Map();
  for (const l of exact) {
    const h = clean(l.he);
    tally.set(h, (tally.get(h) ?? 0) + 1);
  }
  const hebrew = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const words = [term.en, ...(term.labels ?? [])];
  const using = all.filter((l) => visible(l.key) && words.some((w) => wordRe(w).test(l.en)));
  // A real sentence people see: no screen-reader or developer lines, no {{tokens}}.
  const sentences = using
    .filter((l) => {
      const n = l.en.split(/\s+/).length;
      return n >= 5 && n <= 16 && visible(l.key) && !/\{\{/.test(l.en) && !/a11y|A11y|dev|Dev|debug/.test(l.key) && !/\(dev\)|rebuild the app|native|\bnull\b|debug/i.test(l.en);
    })
    .sort((a, b) => a.en.length - b.en.length);
  const example = sentences[Math.floor(sentences.length / 3)] ?? null;
  return {
    id: `term:${term.en.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    group: term.group,
    en: term.en,
    meaning: term.meaning ?? "",
    he: hebrew[0] ?? "",
    alsoHe: hebrew.slice(1, 3),
    uses: using.length,
    seen: placesOf(exact.map((l) => l.key)),
    example: example ? asExample(example) : null,
  };
}

const rows = TERMS.map((term) => {
  const row = build(term);
  if (term.seen) row.seen = term.seen;
  if (term.ex) {
    const exLine = lines.get(term.ex);
    if (!exLine) throw new Error(`no catalog line for example ${term.ex}`);
    if (!visible(term.ex)) PROBLEMS.push(`"${term.en}": example ${term.ex} is not shown in the app`);
    row.example = asExample(exLine);
  }
  return row;
});
const sentences = SENTENCE_KEYS.map((key) => {
  if (!en[key] || !he[key]) throw new Error(`no catalog line for sentence ${key}`);
  if (!visible(key)) PROBLEMS.push(`sentence ${key} is not shown in the app`);
  return { id: `line:${key}`, key, en: en[key], he: he[key], where: whereOf(key) };
});

if (PROBLEMS.length) {
  console.error(PROBLEMS.join("\n"));
  if (!process.argv.includes("--audit")) process.exit(1);
}
if (process.argv.includes("--audit")) {
  for (const r of rows)
    console.log(
      `${r.en.padEnd(18)} ${r.he}${r.alsoHe.length ? " (also " + r.alsoHe.join(" / ") + ")" : ""} · ${r.uses} · seen: ${r.seen ?? "—"}\n` +
        `${"".padEnd(19)}${r.example ? `[${r.example.where}] ${r.example.en} => ${r.example.he}` : "— no example"}`
    );
  for (const x of sentences) console.log(`S ${x.key.padEnd(34)} ${x.where}`);
} else if (process.argv.includes("--print")) {
  for (const g of GROUPS) {
    console.log(`\n== ${g.title}`);
    for (const r of rows.filter((x) => x.group === g.id)) {
      console.log(
        `${r.en.padEnd(20)} ${String(r.uses).padStart(4)}  ${r.he || "—"}${r.alsoHe.length ? "  (also: " + r.alsoHe.join(" / ") + ")" : ""}` +
          (r.he ? "" : `   e.g. ${r.example ? r.example.he : "(no example)"}`)
      );
    }
  }
  console.log(`\n${rows.length} words, ${rows.filter((r) => !r.he).length} without a standalone label`);
} else {
  const out = { builtAt: new Date().toISOString().slice(0, 10), groups: GROUPS, rows, sentences };
  const file = path.join(ROOT, "server/songnook-send/src/review/heTerms.generated.ts");
  fs.writeFileSync(
    file,
    "// GENERATED by scripts/i18n/he-review/terms.mjs — do not edit by hand.\n/* eslint-disable */\nexport const HE_TERMS = " + JSON.stringify(out) + " as const;\n"
  );
  console.log(`wrote ${path.relative(ROOT, file)}: ${rows.length} words, ${sentences.length} sentences`);
}

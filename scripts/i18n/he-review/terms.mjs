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

const clean = (s) => s.replace(/\{\{[^}]+\}\}/g, "").replace(/[\s:·…?!.]+$/g, "").replace(/\s+/g, " ").trim();
const norm = (s) => s.replace(/\{\{[^}]+\}\}/g, "").replace(/[.…:?!·"“”'’]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w) => new RegExp(`(^|[^A-Za-z])${escape(w)}(s|es)?($|[^A-Za-z])`, "i");

function pinned(term) {
  const base = (k) => k.replace(PLURAL, "");
  const found = (term.keys ?? []).map((k) => ({ key: base(k), en: en[k] ?? lines.get(base(k))?.en, he: he[k] ?? lines.get(base(k))?.he })).filter((l) => l.en && l.he);
  if (!found.length) throw new Error(`no catalog line for pinned keys of "${term.en}"`);
  const head = found[0];
  const isSentence = (l) => l.en.split(/\s+/).length >= 3;
  const example = term.he && isSentence(head) ? head : found.find((l, i) => i > 0 && isSentence(l)) ?? (isSentence(head) ? head : null);
  return {
    id: `term:${term.en.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    group: term.group,
    en: term.en,
    meaning: term.meaning ?? "",
    he: term.he ?? clean(head.he),
    alsoHe: [],
    uses: all.filter((l) => wordRe(term.en.replace(/ \(.*\)$/, "")).test(l.en)).length,
    example: example ? { en: example.en, he: example.he } : null,
  };
}

function build(term) {
  if (term.keys) return pinned(term);
  const labels = [term.en, ...(term.labels ?? [])].map(norm);
  const exact = all.filter((l) => labels.includes(norm(l.en)));
  const tally = new Map();
  for (const l of exact) {
    const h = clean(l.he);
    tally.set(h, (tally.get(h) ?? 0) + 1);
  }
  const hebrew = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const words = [term.en, ...(term.labels ?? [])];
  const using = all.filter((l) => words.some((w) => wordRe(w).test(l.en)));
  // A real sentence people see: no screen-reader or developer lines, no {{tokens}}.
  const sentences = using
    .filter((l) => {
      const n = l.en.split(/\s+/).length;
      return n >= 5 && n <= 16 && !/\{\{/.test(l.en) && !/a11y|A11y|dev|Dev|debug/.test(l.key) && !/\(dev\)/i.test(l.en);
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
    example: example ? { en: example.en, he: example.he } : null,
  };
}

const rows = TERMS.map((term) => {
  const row = build(term);
  if (term.ex) {
    if (!en[term.ex] || !he[term.ex]) throw new Error(`no catalog line for example ${term.ex}`);
    row.example = { en: en[term.ex], he: he[term.ex] };
  }
  return row;
});
const sentences = SENTENCE_KEYS.map((key) => {
  if (!en[key] || !he[key]) throw new Error(`no catalog line for sentence ${key}`);
  return { id: `line:${key}`, key, en: en[key], he: he[key] };
});

if (process.argv.includes("--print")) {
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

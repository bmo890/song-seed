// Lays the translator's edits from the Hebrew review (songnook.app/review/he/<link>,
// "Download backup") over src/i18n/locales/he.ts.
//
//   node scripts/i18n/he-review/apply.mjs <songnook-hebrew-review-….json> [--dry-run]
//
// A line's new Hebrew goes to every key it covers ("Used in N places"), form by form.
// A form whose {{tokens}} differ from the Hebrew it replaces is skipped and listed:
// fix it on the review page (or by hand) rather than ship a broken string. Key terms are
// decisions, not lines: they are listed for applying across the catalog by hand.
// Afterwards: npx tsc --noEmit && npx jest src/__tests__/translations.test.ts, then walk
// the Hebrew app in the simulator (longer words wrap).
import fs from "node:fs";
import { readCatalog, readHeader, writeCatalog } from "../catalog.mjs";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("usage: node scripts/i18n/he-review/apply.mjs <export.json> [--dry-run]");
  process.exit(1);
}
const dryRun = flags.includes("--dry-run");
const exported = JSON.parse(fs.readFileSync(file, "utf8"));
if (exported.review !== "he") throw new Error(`not a Hebrew review export: ${exported.review}`);

const he = readCatalog("he");
const tokens = (text) => [...(text ?? "").matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(",");

function slot(path) {
  const parts = path.split(".");
  let node = he;
  for (const part of parts.slice(0, -1)) {
    node = node?.[part];
    if (!node || typeof node !== "object") return null;
  }
  const leaf = parts[parts.length - 1];
  return typeof node[leaf] === "string" ? { node, leaf } : null;
}

let changedKeys = 0;
let changedLines = 0;
const skipped = [];
const missing = [];
const terms = [];
const notes = [];
for (const line of exported.lines) {
  if (line.note) notes.push(`${line.id}: ${line.note}`);
  if (line.id.startsWith("term:")) {
    const next = line.forms[0]?.new;
    if (next) terms.push(`${line.forms[0].en}: ${line.forms[0].he} → ${next}`);
    continue;
  }
  let touched = false;
  for (const form of line.forms) {
    if (!form.new?.trim()) continue;
    if (tokens(form.new) !== tokens(form.he || form.en)) {
      skipped.push(`${line.id}${form.form ? `_${form.form}` : ""}: "${form.new}" (needs ${tokens(form.he || form.en) || "no tokens"})`);
      continue;
    }
    for (const key of line.keys) {
      const target = slot(form.form ? `${key}_${form.form}` : key);
      if (!target) {
        missing.push(`${key}${form.form ? `_${form.form}` : ""}`);
        continue;
      }
      if (target.node[target.leaf] !== form.new) {
        target.node[target.leaf] = form.new;
        changedKeys += 1;
        touched = true;
      }
    }
  }
  if (touched) changedLines += 1;
}

console.log(`${changedLines} lines changed (${changedKeys} keys)${dryRun ? " — dry run, nothing written" : ""}`);
if (skipped.length) console.log(`\nSkipped, {{tokens}} differ (${skipped.length}):\n  ${skipped.join("\n  ")}`);
if (missing.length) console.log(`\nKeys no longer in he.ts (${missing.length}):\n  ${missing.join("\n  ")}`);
if (terms.length) console.log(`\nKey terms to apply across the catalog by hand (${terms.length}):\n  ${terms.join("\n  ")}`);
if (notes.length) console.log(`\nNotes (${notes.length}):\n  ${notes.join("\n  ")}`);
if (!dryRun) writeCatalog("he", he, readHeader("he"));

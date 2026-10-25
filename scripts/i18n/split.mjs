#!/usr/bin/env node
// Split the English catalog into translation parts (docs/i18n/README.md).
//
//   node scripts/i18n/split.mjs <code> <workdir> [--parts 6] [--missing]
//
// Writes <workdir>/part-N.en.json, each a slice of whole top-level sections so
// a translator sees related strings together. With --missing, only the keys the
// language's catalog lacks (after English text was added) are exported.
import fs from "node:fs";
import path from "node:path";
import { countWords, leaves, readCatalog, PLURAL_SUFFIX } from "./catalog.mjs";

const [code, workdir, ...flags] = process.argv.slice(2);
if (!code || !workdir) {
  console.error("usage: split.mjs <code> <workdir> [--parts N] [--missing]");
  process.exit(1);
}
const partsFlag = flags.indexOf("--parts");
const partCount = partsFlag >= 0 ? Number(flags[partsFlag + 1]) : 6;
const onlyMissing = flags.includes("--missing");

const en = readCatalog("en");
let source = en;

if (onlyMissing) {
  const target = readCatalog(code);
  if (!target) throw new Error(`no catalog for ${code}; run without --missing`);
  const have = new Set(leaves(target).map(([key]) => key.replace(PLURAL_SUFFIX, "")));
  // Keep only the English leaves the target lacks, in English order.
  const prune = (node, prefix = "") => {
    if (typeof node === "string") return have.has(prefix.replace(PLURAL_SUFFIX, "")) ? undefined : node;
    const out = {};
    for (const [key, child] of Object.entries(node)) {
      const kept = prune(child, prefix ? `${prefix}.${key}` : key);
      if (kept !== undefined && (typeof kept === "string" || Object.keys(kept).length > 0)) out[key] = kept;
    }
    return out;
  };
  source = prune(en);
}

const keys = Object.keys(source);
if (keys.length === 0) {
  console.log(`${code}: nothing missing.`);
  process.exit(0);
}
const parts = Math.max(1, Math.min(partCount, keys.length));
const target = countWords(source) / parts;
const slices = [];
let current = {};
let words = 0;
for (const key of keys) {
  if (words >= target && slices.length < parts - 1) {
    slices.push(current);
    current = {};
    words = 0;
  }
  current[key] = source[key];
  words += countWords(source[key]);
}
slices.push(current);

fs.mkdirSync(workdir, { recursive: true });
slices.forEach((slice, index) => {
  const file = path.join(workdir, `part-${index + 1}.en.json`);
  fs.writeFileSync(file, JSON.stringify(slice, null, 2));
  console.log(`${file}: ${leaves(slice).length} strings, ${countWords(slice)} words`);
});

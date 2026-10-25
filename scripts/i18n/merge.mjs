#!/usr/bin/env node
// Merge translated parts into src/i18n/locales/<code>.ts (docs/i18n/README.md).
//
//   node scripts/i18n/merge.mjs <code> <workdir> [--header "doc comment text"]
//
// Reads <workdir>/part-N.<code>.json, lays them over the existing catalog (so a
// --missing update only adds keys), orders everything as English does, copies
// each `_other` plural into the language's extra plural forms, then checks:
// every English key present, no extras, every {{token}} kept. Writes nothing
// when a check fails.
import fs from "node:fs";
import path from "node:path";
import {
  extraPluralCategories,
  leaves,
  readCatalog,
  readHeader,
  writeCatalog,
  PLURAL_SUFFIX,
  TOKEN_SWAPS,
} from "./catalog.mjs";

const [code, workdir, ...flags] = process.argv.slice(2);
if (!code || !workdir) {
  console.error('usage: merge.mjs <code> <workdir> [--header "text"]');
  process.exit(1);
}
const headerFlag = flags.indexOf("--header");
const headerText = headerFlag >= 0 ? flags[headerFlag + 1] : null;

const en = readCatalog("en");
const existing = readCatalog(code) ?? {};

const deepMerge = (base, over) => {
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = typeof value === "string" || typeof base[key] !== "object" ? value : deepMerge(base[key], value);
  }
  return out;
};

let merged = existing;
const partFiles = fs
  .readdirSync(workdir)
  .filter((name) => new RegExp(`^part-\\d+\\.${code}\\.json$`).test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
for (const name of partFiles) merged = deepMerge(merged, JSON.parse(fs.readFileSync(path.join(workdir, name), "utf8")));

// English order; plural extras placed right after their `_other`.
const extras = extraPluralCategories(code);
const order = (enNode, node, enParent) => {
  if (typeof enNode === "string") return node;
  const out = {};
  for (const key of Object.keys(enNode)) {
    if (node?.[key] === undefined) continue;
    out[key] = order(enNode[key], node[key], enNode);
    const plural = key.match(/^(.*)_other$/);
    if (plural) {
      for (const category of extras) {
        const extraKey = `${plural[1]}_${category}`;
        if (!(extraKey in enNode)) out[extraKey] = node[extraKey] ?? node[key];
      }
    }
  }
  return out;
};
const result = order(en, merged);

// Checks.
const problems = [];
const enLeaves = new Map(leaves(en));
const outLeaves = new Map(leaves(result));
const base = (key) => key.replace(PLURAL_SUFFIX, "");
for (const [key, value] of enLeaves) {
  if (!outLeaves.has(key)) {
    problems.push(`missing: ${key}`);
    continue;
  }
  for (const token of value.match(/\{\{\w+\}\}/g) ?? []) {
    if (!outLeaves.get(key).includes(token) && !TOKEN_SWAPS[key]?.includes(outLeaves.get(key).match(/\{\{\w+\}\}/g)?.join(""))) {
      problems.push(`token ${token} lost: ${key}`);
    }
  }
}
const enBases = new Set([...enLeaves.keys()].map(base));
for (const key of outLeaves.keys()) if (!enBases.has(base(key))) problems.push(`not in English: ${key}`);

if (problems.length > 0) {
  console.error(problems.slice(0, 40).join("\n"));
  console.error(`${problems.length} problem(s); ${code}.ts not written.`);
  process.exit(2);
}

const header = headerText
  ? `/**\n${headerText.split("\n").map((line) => ` * ${line}`.trimEnd()).join("\n")}\n */\n`
  : readHeader(code);
writeCatalog(code, result, header);
console.log(`${code}.ts: ${outLeaves.size} strings (${enLeaves.size} English${extras.length ? `, plus ${extras.join("/")} plurals` : ""}).`);

#!/usr/bin/env node
// Builds src/domain/data/wordsPtBr.json: the most common Brazilian Portuguese
// words, most common first, for rhymes (domain/portugueseRhyme.ts) and for
// ranking thesaurus results.
//
//   node scripts/wordtools/build-words-pt.mjs <pt_br_50k.txt> [count]
//
// Input (download once, not committed): FrequencyWords, OpenSubtitles 2018
// (CC BY-SA 4.0), https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt_br/pt_br_50k.txt
// This derived list is CC BY-SA 4.0 too (credited in Help & info).
import fs from "node:fs";
import path from "node:path";

const [input, countArg] = process.argv.slice(2);
if (!input) {
  console.error("usage: build-words-pt.mjs <pt_br_50k.txt> [count]");
  process.exit(1);
}
const WANT = Number(countArg ?? 40000);
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../src/domain/data/wordsPtBr.json");

const words = [];
for (const line of fs.readFileSync(input, "utf8").split("\n")) {
  if (words.length >= WANT) break;
  const [word] = line.trim().split(" ");
  // Letters only; one-letter words other than a/e/é/o add nothing to rhyme.
  if (!word || !/^[a-zçáéíóúâêôãõàü]+$/.test(word)) continue;
  if (word.length === 1 && !"aeéo".includes(word)) continue;
  words.push(word);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ source: "FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0", words }));
console.log(`${OUT}: ${words.length} words, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);

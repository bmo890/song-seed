#!/usr/bin/env node
// Builds src/domain/data/rhymesDe.json, the German rhyme index the Word Finder
// reads on the phone (no German rhyme service exists; research 2026-10-25).
//
//   node scripts/wordtools/build-rhymes-de.mjs <ipa-dict de.txt> <de_50k.txt> [count]
//
// Inputs (download once, not committed):
//   ipa-dict German, pronunciations from Wiktionary (CC BY-SA):
//     https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/de.txt
//   FrequencyWords, OpenSubtitles 2018 (CC BY-SA 4.0):
//     https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt
// The output is derived from both and is shared under CC BY-SA 4.0 (credited
// in Help & about).
//
// German rhyme runs from the vowel of the last stressed syllable to the end, as
// it sounds: Rad and Rat rhyme (final devoicing), Liebe and Triebe do, lieben
// and Leben don't. Spelling can't say that (vowel length is unmarked), so the
// key comes from the IPA. A compound rhymes on its last stressed part
// (Liebeslied on -lied), so a secondary stress mark counts too.
import fs from "node:fs";
import path from "node:path";

const [ipaFile, frequencyFile, countArg] = process.argv.slice(2);
if (!ipaFile || !frequencyFile) {
  console.error("usage: build-rhymes-de.mjs <de.txt> <de_50k.txt> [count]");
  process.exit(1);
}
const WANT = Number(countArg ?? 40000);
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../src/domain/data/rhymesDe.json");

// Vowel symbols German IPA uses; a nucleus is a vowel plus length, tie and
// non-syllabic marks (aɪ̯, iː).
const VOWELS = "aeiouyɛɪɔʊʏœøɐəɑæ";
const NUCLEUS = new RegExp(`[${VOWELS}][\\u0303\\u0329]?(?:ː)?(?:[${VOWELS}]\\u032f)?`, "g");
const SYLLABIC = /[nlmʁ]̩/g;

function clean(ipa) {
  return ipa.replace(/[/\[\]]/g, "").replace(/\./g, "").replace(/[ʔ]/g, "").trim();
}

/** The rhyme tail and its vowels for one pronunciation, or null. */
function rhymeOf(ipa) {
  const sound = clean(ipa);
  const stress = Math.max(sound.lastIndexOf("ˈ"), sound.lastIndexOf("ˌ"));
  const from = stress >= 0 ? sound.slice(stress + 1) : sound;
  const first = from.search(new RegExp(`[${VOWELS}]`));
  if (first < 0) return null;
  const tail = from.slice(first).replace(/[ˈˌ]/g, "");
  // A syllabic consonant (the n of laufen) is a syllable with a hidden ə.
  const vowels = (tail.replace(SYLLABIC, (consonant) => `ə${consonant[0]}`).match(NUCLEUS) ?? []).join(" ");
  const syllables = (sound.replace(/[ˈˌ]/g, "").match(NUCLEUS) ?? []).length + (sound.match(SYLLABIC) ?? []).length;
  return { tail, vowels, syllables };
}

// Pronunciations, keyed by lowercase form; keep the written forms (Liebe, liebe).
const pronunciations = new Map();
for (const line of fs.readFileSync(ipaFile, "utf8").split("\n")) {
  const [word, ipas] = line.split("\t");
  if (!word || !ipas || /[^A-Za-zÄÖÜäöüß]/.test(word)) continue;
  // Abbreviations (RAD, OB) are spelled out letter by letter, not words.
  if (word.length > 1 && word === word.toUpperCase()) continue;
  const variants = ipas.split(",").map((ipa) => ipa.trim()).filter(Boolean);
  const key = word.toLowerCase();
  const list = pronunciations.get(key) ?? [];
  list.push({ word, variants });
  pronunciations.set(key, list);
}

const words = [];
const tails = new Map();
const vowelSets = new Map();
const idOf = (map, value) => {
  if (!map.has(value)) map.set(value, map.size);
  return map.get(value);
};

let rank = 0;
for (const line of fs.readFileSync(frequencyFile, "utf8").split("\n")) {
  if (words.length >= WANT) break;
  const [lower] = line.trim().split(" ");
  rank++;
  if (!lower || lower.length < 2) continue;
  const entries = pronunciations.get(lower);
  if (!entries) continue;
  // Subtitles are lowercased, so the written form is a guess: the very common
  // words are mostly function words and verbs (es, wenn, liebe), the rest show
  // the noun's capital when the dictionary has one (Herz, Nacht).
  const plain = entries.find((candidate) => candidate.word === lower);
  const capital = entries.find((candidate) => candidate.word !== lower);
  const entry = (rank <= 1000 ? plain ?? capital : capital ?? plain) ?? entries[0];
  // Up to two pronunciations (Rad is said with a long or short a).
  const keys = [];
  for (const variant of entry.variants.slice(0, 2)) {
    const rhyme = rhymeOf(variant);
    if (rhyme && !keys.some((key) => key.tail === rhyme.tail)) keys.push(rhyme);
  }
  if (keys.length === 0) continue;
  words.push([entry.word, keys.map((key) => idOf(tails, key.tail)), keys.map((key) => idOf(vowelSets, key.vowels)), keys[0].syllables]);
}

// Compact columns, most frequent word first.
const data = {
  source: "ipa-dict (Wiktionary, CC BY-SA) + FrequencyWords (OpenSubtitles 2018, CC BY-SA 4.0); this file CC BY-SA 4.0",
  tails: [...tails.keys()],
  vowels: [...vowelSets.keys()],
  words: words.map(([word]) => word),
  tail: words.map(([, ids]) => (ids.length === 1 ? ids[0] : ids)),
  vowel: words.map(([, , ids]) => (ids.length === 1 ? ids[0] : ids)),
  syllables: words.map(([, , , count]) => count),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`${OUT}: ${words.length} words, ${tails.size} rhyme tails, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);

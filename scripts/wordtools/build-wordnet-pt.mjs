#!/usr/bin/env node
// Builds src/domain/data/wordnetPt.json, the Portuguese thesaurus the Word
// Finder reads on the phone: synonyms, broader terms, kinds of, parts of and
// opposites (no Portuguese thesaurus API is open to apps; research 2026-10-25).
// Its definitions are left out: they often belong to another sense of the word
// (casa → "linha de família aristocrática").
//
//   node scripts/wordtools/build-wordnet-pt.mjs <own-pt-*.xml>
//
// Input (download once, not committed): OpenWordNet-PT v1.1.0, CC BY 4.0,
//   https://github.com/own-pt/openWordnet-PT/releases/download/v1.1.0/own-pt-2026.04.07.tar.xz
// Credited in Help & info. Words are limited to those in wordsPtBr.json (the
// common Brazilian words), plus every member of a synset one of them is in.
import fs from "node:fs";
import path from "node:path";

const [input] = process.argv.slice(2);
if (!input) {
  console.error("usage: build-wordnet-pt.mjs <own-pt.xml>");
  process.exit(1);
}
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.resolve(HERE, "../../src/domain/data/wordnetPt.json");
const common = new Set(JSON.parse(fs.readFileSync(path.resolve(HERE, "../../src/domain/data/wordsPtBr.json"), "utf8")).words);

const xml = fs.readFileSync(input, "utf8");
const decode = (text) => text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const usable = (form) => /^[a-zçáéíóúâêôãõàü-]+(?: [a-zçáéíóúâêôãõàü-]+)?$/i.test(form);

// Lexical entries: lemma, its senses, and word-level antonyms.
const senseWord = new Map();
const senseSynset = new Map();
const lemmaSynsets = new Map();
const senseAntonyms = new Map();
for (const match of xml.matchAll(/<LexicalEntry [^>]*>([\s\S]*?)<\/LexicalEntry>/g)) {
  const body = match[1];
  const form = decode(body.match(/writtenForm="([^"]*)"/)?.[1] ?? "");
  if (!usable(form)) continue;
  const lemma = form.toLowerCase();
  for (const sense of body.matchAll(/<Sense id="([^"]*)" synset="([^"]*)"\s*\/?>([\s\S]*?)(?=<Sense |$)/g)) {
    senseWord.set(sense[1], lemma);
    senseSynset.set(sense[1], sense[2]);
    lemmaSynsets.set(lemma, [...(lemmaSynsets.get(lemma) ?? []), sense[2]]);
    for (const rel of sense[3].matchAll(/<SenseRelation target="([^"]*)" relType="antonym"/g)) {
      senseAntonyms.set(sense[1], [...(senseAntonyms.get(sense[1]) ?? []), rel[1]]);
    }
  }
}

// Synsets: members, relations, definition.
const RELATIONS = { hypernym: "up", instance_hypernym: "up", hyponym: "down", mero_part: "parts", mero_member: "parts", mero_substance: "parts", similar: "like", antonym: "opposite" };
const synsets = new Map();
for (const match of xml.matchAll(/<Synset id="([^"]*)"[^>]*?members="([^"]*)"[^>]*?(?:\/>|>([\s\S]*?)<\/Synset>)/g)) {
  const [, id, members, body = ""] = match;
  const words = [...new Set(members.split(" ").map((sense) => senseWord.get(sense)).filter(Boolean))];
  const relations = {};
  for (const rel of body.matchAll(/<SynsetRelation target="([^"]*)" relType="([^"]*)"/g)) {
    const kind = RELATIONS[rel[2]];
    if (kind) (relations[kind] ??= []).push(rel[1]);
  }
  const definition = decode(body.match(/<Definition>([\s\S]*?)<\/Definition>/)?.[1] ?? "").trim();
  synsets.set(id, { words, relations, definition });
}

// Keep the common words and everything their synsets touch.
const keptSynsets = new Set();
for (const word of common) for (const id of lemmaSynsets.get(word) ?? []) keptSynsets.add(id);
const related = new Set();
for (const id of keptSynsets) for (const targets of Object.values(synsets.get(id)?.relations ?? {})) for (const t of targets) related.add(t);
for (const id of related) keptSynsets.add(id);

const wordIds = new Map();
const wordList = [];
const wordId = (word) => {
  if (!wordIds.has(word)) {
    wordIds.set(word, wordList.length);
    wordList.push(word);
  }
  return wordIds.get(word);
};
const synIds = new Map();
const synList = [];
for (const id of keptSynsets) {
  const synset = synsets.get(id);
  if (!synset || synset.words.length === 0) continue;
  synIds.set(id, synList.length);
  synList.push(id);
}
const out = { source: "OpenWordNet-PT v1.1.0 (CC BY 4.0)", words: [], syn: [], up: [], down: [], parts: [], like: [], wordSyn: {}, opposite: {} };
for (const id of synList) {
  const synset = synsets.get(id);
  out.syn.push(synset.words.map(wordId));
  for (const kind of ["up", "down", "parts", "like"]) {
    out[kind].push((synset.relations[kind] ?? []).map((target) => synIds.get(target)).filter((x) => x !== undefined).slice(0, 24));
  }
}
for (const [lemma, ids] of lemmaSynsets) {
  if (!common.has(lemma)) continue;
  const kept = ids.map((id) => synIds.get(id)).filter((x) => x !== undefined);
  if (kept.length) out.wordSyn[wordId(lemma)] = kept;
}
for (const [sense, targets] of senseAntonyms) {
  const word = senseWord.get(sense);
  if (!common.has(word)) continue;
  const list = new Set([...(out.opposite[wordId(word)] ?? []), ...targets.map((t) => senseWord.get(t)).filter(Boolean).map(wordId)]);
  out.opposite[wordId(word)] = [...list];
}
// Synset-level antonyms (adjectives) count as word opposites too.
for (const id of synList) {
  for (const target of synsets.get(id).relations.opposite ?? []) {
    const other = synsets.get(target);
    if (!other) continue;
    for (const word of synsets.get(id).words) {
      if (!common.has(word)) continue;
      const list = new Set([...(out.opposite[wordId(word)] ?? []), ...other.words.map(wordId)]);
      out.opposite[wordId(word)] = [...list];
    }
  }
}
out.words = wordList;
// Empty relation lists as 0 to keep the file small.
for (const kind of ["up", "down", "parts", "like"]) out[kind] = out[kind].map((list) => (list.length ? list : 0));
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`${OUT}: ${wordList.length} words, ${synList.length} synsets, ${Object.keys(out.wordSyn).length} common words covered, ${Object.keys(out.opposite).length} with opposites, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);

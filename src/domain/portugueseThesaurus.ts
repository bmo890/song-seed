/**
 * Portuguese meanings from a bundled OpenWordNet-PT extract (CC BY 4.0,
 * credited in Help & info), built by scripts/wordtools/build-wordnet-pt.mjs.
 * No Portuguese thesaurus API is open to apps (2026-10-25). Its relations come
 * from the English WordNet and mix a word's senses, so results are ranked by
 * how common each word is in Brazilian speech: the everyday sense rises.
 */
import type { WordLookupMode } from "./wordTools";

type WordnetData = {
  words: string[];
  syn: number[][];
  up: (number[] | 0)[];
  down: (number[] | 0)[];
  parts: (number[] | 0)[];
  like: (number[] | 0)[];
  wordSyn: Record<string, number[]>;
  opposite: Record<string, number[]>;
};

type Loaded = { data: WordnetData; byWord: Map<string, number>; rank: Map<string, number> };

const MAX_RESULTS = 40;
let loaded: Loaded | null = null;

function load(): Loaded {
  if (loaded) return loaded;
  // Loaded on first Portuguese meaning lookup (about 1.7 MB).
  const data = require("./data/wordnetPt.json") as WordnetData;
  const { words } = require("./data/wordsPtBr.json") as { words: string[] };
  const byWord = new Map(data.words.map((word, id) => [word, id]));
  const rank = new Map(words.map((word, position) => [word, position]));
  loaded = { data, byWord, rank };
  return loaded;
}

/** The modes the Portuguese thesaurus serves. */
export const PORTUGUESE_MEANING_MODES = new Set<WordLookupMode>(["similar", "related", "kinds", "parts", "opposite"]);

export function portugueseMeanings(word: string, mode: WordLookupMode): { word: string; score: number }[] {
  const { data, byWord, rank } = load();
  const self = word.trim().toLowerCase();
  const id = byWord.get(self);
  if (id === undefined) return [];
  const synsets = data.wordSyn[id] ?? [];
  const via = (relation: (number[] | 0)[]) => synsets.flatMap((synset) => relation[synset] || []);

  let targets: number[] = [];
  if (mode === "similar") targets = [...synsets, ...via(data.like)];
  else if (mode === "related") targets = via(data.up);
  else if (mode === "kinds") targets = via(data.down);
  else if (mode === "parts") targets = via(data.parts);

  const found = new Set<string>(
    mode === "opposite"
      ? (data.opposite[id] ?? []).map((other) => data.words[other])
      : targets.flatMap((synset) => data.syn[synset].map((member) => data.words[member]))
  );
  found.delete(self);
  // Common words first; words outside the list keep their order after them.
  return [...found]
    .map((text, order) => ({ text, order, common: rank.get(text) ?? Infinity }))
    .sort((a, b) => a.common - b.common || a.order - b.order)
    .slice(0, MAX_RESULTS)
    .map(({ text }, position) => ({ word: text, score: MAX_RESULTS - position }));
}

/**
 * German rhymes, from a bundled index (2026-10-25). No German rhyme service
 * exists (Datamuse ignores v=de); German rhyme is a matter of sound, which
 * spelling can't show (vowel length is unmarked, Rad rhymes with Rat), so the
 * index carries each common word's rhyme tail worked out from its Wiktionary
 * pronunciation. Built by scripts/wordtools/build-rhymes-de.mjs; data CC BY-SA
 * (ipa-dict/Wiktionary + FrequencyWords), credited in the Word Finder.
 *
 *   - Rhymes: the same sound from the last stressed vowel on (Herz · Schmerz).
 *   - Near: the same vowels and the same last sound (Leben · wegen), or, when
 *     that finds little, the same vowels alone.
 */

type RhymeIndexData = {
  tails: string[];
  vowels: string[];
  words: string[];
  tail: (number | number[])[];
  vowel: (number | number[])[];
  syllables: number[];
};

type RhymeIndex = {
  data: RhymeIndexData;
  byWord: Map<string, number>;
  byTail: Map<number, number[]>;
  byVowels: Map<number, number[]>;
};

export type GermanRhyme = { word: string; numSyllables: number };

/** The most common words (das, was, hat) crowd near rhymes without helping. */
const NEAR_SKIP_RANK = 200;
const MIN_NEAR = 6;
const MAX_RESULTS = 40;

let index: RhymeIndex | null = null;

function ids(value: number | number[]): number[] {
  return Array.isArray(value) ? value : [value];
}

function loadIndex(): RhymeIndex {
  if (index) return index;
  // Loaded on first German lookup, not at app start (about 1 MB).
  const data = require("./data/rhymesDe.json") as RhymeIndexData;
  const byWord = new Map<string, number>();
  const byTail = new Map<number, number[]>();
  const byVowels = new Map<number, number[]>();
  data.words.forEach((word, position) => {
    const key = word.toLowerCase();
    if (!byWord.has(key)) byWord.set(key, position);
    for (const id of ids(data.tail[position])) byTail.set(id, [...(byTail.get(id) ?? []), position]);
    for (const id of ids(data.vowel[position])) byVowels.set(id, [...(byVowels.get(id) ?? []), position]);
  });
  index = { data, byWord, byTail, byVowels };
  return index;
}

/** The last sound of a rhyme tail, marks aside (Herz → s, Nacht → t). */
function lastSound(tail: string): string {
  return tail.replace(/[ː̯̩̃͡]/g, "").slice(-1);
}

/** Rhymes (or near rhymes) for a German word, most common first. Empty when
 *  the word isn't among the ~38,000 the index knows. */
export function germanRhymes(word: string, near: boolean): GermanRhyme[] {
  const { data, byWord, byTail, byVowels } = loadIndex();
  const self = byWord.get(word.trim().toLowerCase());
  if (self === undefined) return [];
  const tails = new Set(ids(data.tail[self]));
  const toRhyme = (position: number): GermanRhyme => ({
    word: data.words[position],
    numSyllables: data.syllables[position],
  });

  if (!near) {
    const found = new Set<number>();
    for (const tail of tails) for (const position of byTail.get(tail) ?? []) if (position !== self) found.add(position);
    return [...found].sort((a, b) => a - b).slice(0, MAX_RESULTS).map(toRhyme);
  }

  const ends = new Set([...tails].map((tail) => lastSound(data.tails[tail])));
  const assonant: number[] = [];
  for (const vowels of ids(data.vowel[self])) {
    for (const position of byVowels.get(vowels) ?? []) {
      if (position === self || position < NEAR_SKIP_RANK) continue;
      if (ids(data.tail[position]).some((tail) => tails.has(tail))) continue;
      assonant.push(position);
    }
  }
  const unique = [...new Set(assonant)].sort((a, b) => a - b);
  const closer = unique.filter((position) => ids(data.tail[position]).some((tail) => ends.has(lastSound(data.tails[tail]))));
  return (closer.length >= MIN_NEAR ? closer : unique).slice(0, MAX_RESULTS).map(toRhyme);
}

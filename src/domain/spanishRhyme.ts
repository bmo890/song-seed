/**
 * Spanish rhyme, worked out from spelling (2026-10-25). Datamuse's Spanish
 * vocabulary (`v=es`) has no rhyme relation, but Spanish stress is written
 * down: an accent mark says where it falls, and otherwise words ending in a
 * vowel, n or s stress the next-to-last syllable and the rest the last. From
 * the stressed vowel to the end is the rhyme:
 *   - rima consonante (Rhymes): the same sounds from the stressed vowel on —
 *     corazón · canción, noche · coche;
 *   - rima asonante (Near): the same vowels only — noche · nombre · bosque.
 * The finder fetches candidates by spelling pattern and keeps the ones whose
 * computed rhyme matches, so a misspelt or differently stressed word drops out.
 */

const ACCENTED: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u" };
const STRONG = new Set(["a", "e", "o", "á", "é", "í", "ó", "ú"]);
const VOWEL = new Set(["a", "e", "i", "o", "u", "á", "é", "í", "ó", "ú", "ü"]);

function plain(char: string): string {
  return ACCENTED[char] ?? char;
}

/** One syllable's vowel group: where it sits and which letter carries it. */
type Nucleus = { start: number; end: number; peak: number };

/**
 * The vowel nuclei of a single lowercase word. Weak vowels (i, u) glide into a
 * neighbour (cie·lo, cui·da); two strong vowels split (po·e·ta); an accent on
 * a weak vowel makes it strong (dí·a). The u of que/qui/gue/gui is silent, and
 * a final y after a vowel is a vowel (hoy, rey).
 */
function nuclei(word: string): Nucleus[] {
  const letters = [...word];
  const isVowelAt = (i: number) => {
    const char = letters[i];
    if (char === "y") return i === letters.length - 1 && i > 0 && VOWEL.has(letters[i - 1]);
    if (!VOWEL.has(char)) return false;
    if (char === "u" && i > 0 && (letters[i - 1] === "q" || letters[i - 1] === "g")) {
      const next = letters[i + 1];
      if (next === "e" || next === "i" || next === "é" || next === "í") return false;
    }
    return true;
  };
  const strong = (i: number) => STRONG.has(letters[i]);
  const out: Nucleus[] = [];
  let i = 0;
  while (i < letters.length) {
    if (!isVowelAt(i)) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < letters.length && isVowelAt(end + 1)) {
      // Two strong vowels never share a syllable.
      if (strong(end) && strong(end + 1)) break;
      end++;
    }
    let peak = i;
    for (let j = i; j <= end; j++) if (strong(j)) peak = j;
    // Two weak vowels (ui, iu): the second carries it.
    if (!strong(peak)) peak = end;
    out.push({ start: i, end, peak });
    i = end + 1;
  }
  return out;
}

/** The index of the stressed nucleus, by the written-accent rules. */
function stressedIndex(word: string, groups: Nucleus[]): number {
  if (groups.length <= 1) return 0;
  const letters = [...word];
  for (let g = groups.length - 1; g >= 0; g--) {
    for (let j = groups[g].start; j <= groups[g].end; j++) {
      if ("áéíóú".includes(letters[j])) return g;
    }
  }
  const last = letters[letters.length - 1];
  const penultimate = VOWEL.has(last) || last === "n" || last === "s" || (last === "y" && groups.length > 1);
  return penultimate ? groups.length - 2 : groups.length - 1;
}

/** Sound-alike spellings fold together (seseo, b/v, silent h), as most of the
 *  Spanish-speaking world hears them: casa rhymes with taza. */
function soundKey(text: string): string {
  return [...text]
    .map(plain)
    .join("")
    // ch is its own sound; only a lone h is silent.
    .replace(/ch/g, "\u0001")
    .replace(/h/g, "")
    .replace(/v/g, "b")
    .replace(/z/g, "s")
    .replace(/c([ei])/g, "s$1")
    .replace(/qu([ei])/g, "k$1")
    .replace(/c/g, "k")
    .replace(/ll/g, "y")
    .replace(/gu([ei])/g, "g$1")
    .replace(/y$/, "i")
    .replace(/\u0001/g, "ch");
}

export type SpanishRhyme = {
  /** From the stressed vowel to the end, as it sounds (accents and seseo folded). */
  tail: string;
  /** The vowels heard from the stressed one on: noche → "oe". */
  vowels: string;
  /** The written ending, for the spelling-pattern query. */
  spelling: string;
  syllables: number;
};

/** A single Spanish word's rhyme, or null for anything that isn't one word. */
export function spanishRhyme(input: string): SpanishRhyme | null {
  const word = input.trim().toLowerCase();
  if (!word || /[^a-zñáéíóúü]/.test(word)) return null;
  const groups = nuclei(word);
  if (groups.length === 0) return null;
  const stressed = stressedIndex(word, groups);
  const letters = [...word];
  const from = groups[stressed].peak;
  const spelling = letters.slice(from).join("");
  const vowels = groups
    .slice(stressed)
    .map((group) => plain(letters[group.peak]))
    .join("");
  return { tail: soundKey(spelling), vowels, spelling, syllables: groups.length };
}

/** Perfect (consonant) rhyme: the same sounds from the stressed vowel on. */
export function isSpanishRhyme(a: SpanishRhyme, b: SpanishRhyme): boolean {
  return a.tail === b.tail;
}

/** Assonant rhyme that isn't also a perfect one. */
export function isSpanishAssonance(a: SpanishRhyme, b: SpanishRhyme): boolean {
  return a.vowels === b.vowels && a.tail !== b.tail;
}

/** The Datamuse spelling pattern that finds candidates for a rhyme. */
export function spanishRhymePattern(rhyme: SpanishRhyme, near: boolean): string {
  if (!near) return `*${rhyme.spelling}`;
  // The vowels in order, anything between; a word that ends on a consonant
  // (amor) keeps the door open after its last vowel.
  const endsOnVowel = VOWEL.has([...rhyme.spelling].pop() ?? "");
  return `*${[...rhyme.vowels].join("*")}${endsOnVowel ? "" : "*"}`;
}

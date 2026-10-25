/**
 * Portuguese (Brazil) rhyme, worked out from spelling (2026-10-25). No
 * Portuguese rhyme service exists, and pronunciation lists cover too few common
 * words, but Portuguese spelling says where the stress falls: an accent mark
 * (é, ô, ã…) marks it; otherwise words ending in a, e, o (plus s), am, em, ens
 * stress the next-to-last syllable and the rest the last. From the stressed
 * vowel to the end is the rhyme:
 *   - rima perfeita (Rhymes): the same sounds from there on — coração · canção;
 *   - rima toante (Near): the same vowels only — saudade · cidade · amar · lugar.
 * Spelling can't tell open é from closed ê when no accent is written, so those
 * pairs count as rhymes; Brazilian songwriting treats them as rhymes too.
 */

const VOWEL = /[aeiouáéíóúâêôãõàü]/;
const STRESS_MARK = /[áéíóúâêôãõ]/;
const PLAIN: Record<string, string> = {
  á: "a", à: "a", â: "a", ã: "a", é: "e", ê: "e", í: "i", ó: "o", ô: "o", õ: "o", ú: "u", ü: "u",
};

function plain(char: string): string {
  return PLAIN[char] ?? char;
}

type Nucleus = { start: number; end: number; peak: number };

/** Vowel groups of a lowercase word. Two strong vowels split (po·e·ta); i and u
 *  glide into a neighbour (noi·te, cau·sa) unless accented (sa·ú·de); the u of
 *  que/qui/gue/gui is silent; ão, õe, ãe are one nasal syllable. */
function nuclei(word: string): Nucleus[] {
  const letters = [...word];
  const isVowelAt = (i: number) => {
    if (!VOWEL.test(letters[i])) return false;
    if (letters[i] === "u" && i > 0 && (letters[i - 1] === "q" || letters[i - 1] === "g")) {
      const next = letters[i + 1];
      if (next && "eiéíêî".includes(next)) return false;
    }
    return true;
  };
  const strong = (i: number) => /[aeoáéóâêôãõà]/.test(letters[i]);
  const out: Nucleus[] = [];
  let i = 0;
  while (i < letters.length) {
    if (!isVowelAt(i)) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < letters.length && isVowelAt(end + 1)) {
      const here = letters[end];
      const next = letters[end + 1];
      const nasalPair = /[ãõ]/.test(here) && /[oe]/.test(next);
      if (!nasalPair && strong(end) && strong(end + 1)) break;
      // An accented i or u is a syllable of its own (saúde, país).
      if (/[íú]/.test(next) || /[íú]/.test(here)) break;
      // i or u before a strong vowel is its own syllable (di·a, sa·bi·a, ru·a),
      // except after an accent mark, where it glides (his·tó·ria, á·rea).
      if (!strong(end) && strong(end + 1) && !letters.slice(0, end).some((char) => /[áéíóúâêô]/.test(char))) break;
      end++;
    }
    let peak = i;
    for (let j = i; j <= end; j++) if (strong(j)) {
      peak = j;
      break;
    }
    if (!strong(peak)) peak = end;
    out.push({ start: i, end, peak });
    i = end + 1;
  }
  return out;
}

function stressedIndex(word: string, groups: Nucleus[]): number {
  if (groups.length <= 1) return 0;
  const letters = [...word];
  for (let g = groups.length - 1; g >= 0; g--) {
    for (let j = groups[g].start; j <= groups[g].end; j++) {
      // A tilde on a non-final syllable (órfão) yields to the acute.
      if (STRESS_MARK.test(letters[j]) && !(/[ãõ]/.test(letters[j]) && groups.slice(0, g).some((earlier) =>
        letters.slice(earlier.start, earlier.end + 1).some((char) => /[áéíóúâêô]/.test(char))))) {
        return g;
      }
    }
  }
  // Paroxytone endings: vowel a/e/o (+s), am, em, ens.
  const paroxytone = /(?:[aeo]s?|am|em|ens)$/.test(word);
  return paroxytone ? groups.length - 2 : groups.length - 1;
}

/** Spellings of one sound fold together, as Brazilian Portuguese hears them:
 *  ç/ss/c(e,i)/s(e,i) → s, final l → u (mal · mau), ch → x, g(e,i) → j,
 *  silent h, final -am as unstressed -ão. */
function soundKey(text: string): string {
  return [...text]
    .map(plain)
    .join("")
    .replace(/ç/g, "s")
    .replace(/ss/g, "s")
    .replace(/c(?=[ei])/g, "s")
    .replace(/qu(?=[ei])/g, "k")
    .replace(/gu(?=[ei])/g, "g")
    .replace(/g(?=[ei])/g, "j")
    .replace(/ch/g, "x")
    .replace(/(?<![lnc])h/g, "")
    .replace(/c/g, "k")
    .replace(/l$/, "u")
    .replace(/l(?=s$)/, "u")
    .replace(/z$/, "s")
    .replace(/n$/, "m");
}

export type PortugueseRhyme = {
  /** From the stressed vowel to the end, as it sounds. */
  tail: string;
  /** The vowels heard from the stressed one on: saudade → "ae". */
  vowels: string;
  syllables: number;
};

export function portugueseRhyme(input: string): PortugueseRhyme | null {
  const word = input.trim().toLowerCase();
  if (!word || /[^a-zçáéíóúâêôãõàü-]/.test(word)) return null;
  const groups = nuclei(word);
  if (groups.length === 0) return null;
  const stressed = stressedIndex(word, groups);
  const letters = [...word];
  const tail = soundKey(letters.slice(groups[stressed].peak).join(""));
  const vowels = groups
    .slice(stressed)
    .map((group) => plain(letters[group.peak]))
    .join("");
  return { tail, vowels, syllables: groups.length };
}

export function isPortugueseRhyme(a: PortugueseRhyme, b: PortugueseRhyme): boolean {
  return a.tail === b.tail;
}

export function isPortugueseAssonance(a: PortugueseRhyme, b: PortugueseRhyme): boolean {
  return a.vowels === b.vowels && a.tail !== b.tail;
}

// ── Lookup over the bundled word list ─────────────────────────────────────────

type WordList = { words: string[] };
type Index = { words: string[]; byTail: Map<string, number[]>; byVowels: Map<string, number[]>; rhymes: (PortugueseRhyme | null)[] };

/** The most common words (que, não, para) crowd near rhymes without helping. */
const NEAR_SKIP_RANK = 150;
const MAX_RESULTS = 40;
let index: Index | null = null;

function loadIndex(): Index {
  if (index) return index;
  // Loaded on first Portuguese lookup (about 0.4 MB).
  const { words } = require("./data/wordsPtBr.json") as WordList;
  const byTail = new Map<string, number[]>();
  const byVowels = new Map<string, number[]>();
  const rhymes = words.map((word, position) => {
    const rhyme = portugueseRhyme(word);
    if (!rhyme) return null;
    byTail.set(rhyme.tail, [...(byTail.get(rhyme.tail) ?? []), position]);
    byVowels.set(rhyme.vowels, [...(byVowels.get(rhyme.vowels) ?? []), position]);
    return rhyme;
  });
  index = { words, byTail, byVowels, rhymes };
  return index;
}

/** Rhymes (or near rhymes) for a Portuguese word, most common first. Works for
 *  any word, listed or not: its rhyme comes from its spelling. */
export function portugueseRhymes(word: string, near: boolean): { word: string; numSyllables: number }[] {
  const target = portugueseRhyme(word);
  if (!target) return [];
  const { words, byTail, byVowels, rhymes } = loadIndex();
  const self = word.trim().toLowerCase();
  const pick = (positions: number[]) =>
    positions
      .filter((position) => words[position] !== self)
      .slice(0, MAX_RESULTS)
      .map((position) => ({ word: words[position], numSyllables: rhymes[position]?.syllables ?? 0 }));
  if (!near) return pick(byTail.get(target.tail) ?? []);
  return pick(
    (byVowels.get(target.vowels) ?? []).filter(
      (position) => position >= NEAR_SKIP_RANK && rhymes[position]?.tail !== target.tail
    )
  );
}

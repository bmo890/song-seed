import { filterSpanishRhymes, parseSpanishCandidates } from "../domain/wordTools";
import { isSpanishAssonance, isSpanishRhyme, spanishRhyme, spanishRhymePattern } from "../domain/spanishRhyme";

const r = (word: string) => {
  const rhyme = spanishRhyme(word);
  if (!rhyme) throw new Error(`no rhyme for ${word}`);
  return rhyme;
};

describe("spanishRhyme", () => {
  it.each([
    ["corazón", "on", 3],
    ["canción", "on", 2],
    ["noche", "oche", 2],
    ["amor", "or", 2],
    ["cielo", "elo", 2],
    ["día", "ia", 2],
    ["poeta", "eta", 3],
    ["guerra", "erra", 2],
    ["hoy", "oi", 1],
    ["árbol", "arbol", 2],
    ["cuida", "ida", 2],
  ])("%s rhymes on %s with %d syllables", (word, tail, syllables) => {
    expect(r(word).tail).toBe(tail);
    expect(r(word).syllables).toBe(syllables);
  });

  it("finds perfect rhymes, folding accents and seseo", () => {
    expect(isSpanishRhyme(r("corazón"), r("canción"))).toBe(true);
    expect(isSpanishRhyme(r("casa"), r("taza"))).toBe(true);
    expect(isSpanishRhyme(r("noche"), r("coche"))).toBe(true);
    expect(isSpanishRhyme(r("cielo"), r("vuelo"))).toBe(true);
  });

  it("keeps stress apart: a misspelt razon is not razón's rhyme", () => {
    expect(isSpanishRhyme(r("corazón"), r("razon"))).toBe(false);
    expect(isSpanishRhyme(r("cántaro"), r("claro"))).toBe(false);
  });

  it("finds assonance that is not also a perfect rhyme", () => {
    expect(isSpanishAssonance(r("noche"), r("nombre"))).toBe(true);
    expect(isSpanishAssonance(r("casa"), r("gracia"))).toBe(true);
    expect(isSpanishAssonance(r("noche"), r("coche"))).toBe(false);
  });

  it("builds spelling patterns for the lookup", () => {
    expect(spanishRhymePattern(r("corazón"), false)).toBe("*ón");
    expect(spanishRhymePattern(r("noche"), true)).toBe("*o*e");
    expect(spanishRhymePattern(r("amor"), true)).toBe("*o*");
  });

  it("refuses anything that is not one word", () => {
    expect(spanishRhyme("dos palabras")).toBeNull();
    expect(spanishRhyme("")).toBeNull();
  });
});

describe("Spanish rhyme results", () => {
  // Real Datamuse rows for sp=*oche&v=es&md=f (2026-10-25), trimmed.
  const payload = [
    ["noche", 317.32], ["coche", 73.97], ["reproche", 5.52], ["derroche", 2.11], ["broche", 1.93],
    ["anoche", 12.78], ["medianoche", 7.76], ["fantoche", 0.3], ["tololoche", 0.028], ["queroche", 0],
    ["escamoche", 0], ["brioche", 0.104], ["razon", 3],
  ].map(([word, f]) => ({ word, score: 100, tags: [`f:${f}`] }));

  it("keeps common rhymes, most used first, and drops curiosities", () => {
    const words = filterSpanishRhymes("noche", parseSpanishCandidates(payload), false).map((s) => s.word);
    expect(words.slice(0, 3)).toEqual(["coche", "anoche", "medianoche"]);
    expect(words).toContain("brioche");
    expect(words).not.toContain("noche");
    expect(words).not.toContain("tololoche");
    expect(words).not.toContain("queroche");
  });

  it("counts syllables itself", () => {
    const [cielo] = filterSpanishRhymes("vuelo", parseSpanishCandidates([{ word: "cielo", score: 1, tags: ["f:50"] }]), false);
    expect(cielo.numSyllables).toBe(2);
  });
});

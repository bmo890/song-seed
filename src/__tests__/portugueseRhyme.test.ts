import { isPortugueseAssonance, isPortugueseRhyme, portugueseRhyme, portugueseRhymes } from "../domain/portugueseRhyme";

const r = (word: string) => {
  const rhyme = portugueseRhyme(word);
  if (!rhyme) throw new Error(`no rhyme for ${word}`);
  return rhyme;
};

describe("portugueseRhyme", () => {
  it.each([
    ["coração", "ao", 3],
    ["canção", "ao", 2],
    ["amor", "or", 2],
    ["saudade", "ade", 3],
    ["noite", "oite", 2],
    ["café", "e", 2],
    ["lâmpada", "ampada", 3],
    ["saúde", "ude", 3],
    ["mal", "au", 1],
    ["querer", "er", 2],
    ["cantam", "antam", 2],
  ])("%s rhymes on %s with %d syllables", (word, tail, syllables) => {
    expect(r(word).tail).toBe(tail);
    expect(r(word).syllables).toBe(syllables);
  });

  it("finds perfect rhymes across spellings", () => {
    expect(isPortugueseRhyme(r("coração"), r("canção"))).toBe(true);
    expect(isPortugueseRhyme(r("mal"), r("mau"))).toBe(true);
    expect(isPortugueseRhyme(r("paz"), r("faz"))).toBe(true);
    expect(isPortugueseRhyme(r("passo"), r("laço"))).toBe(true);
  });

  it("keeps stress apart", () => {
    expect(isPortugueseRhyme(r("sábia"), r("sabia"))).toBe(false);
  });

  it("finds rima toante", () => {
    expect(isPortugueseAssonance(r("saudade"), r("cidade"))).toBe(false);
    expect(isPortugueseAssonance(r("amor"), r("calor"))).toBe(false);
    expect(isPortugueseAssonance(r("noite"), r("dorme"))).toBe(true);
  });

  it("looks rhymes up in the word list, most common first", () => {
    const words = portugueseRhymes("coração", false).map((s) => s.word);
    expect(words).toEqual(expect.arrayContaining(["não", "então", "mão"]));
    expect(words).not.toContain("coração");
    expect(portugueseRhymes("saudade", false).map((s) => s.word)).toContain("verdade");
  });
});

describe("Portuguese hiatus", () => {
  it.each([
    ["dia", 2],
    ["sabia", 3],
    ["história", 3],
    ["rua", 2],
  ])("%s has %d syllables", (word, syllables) => {
    expect(portugueseRhyme(word)?.syllables).toBe(syllables);
  });
});

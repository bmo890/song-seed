import { germanRhymes } from "../domain/germanRhyme";
import { parseOpenThesaurus } from "../domain/wordTools";

const words = (word: string, near: boolean) => germanRhymes(word, near).map((rhyme) => rhyme.word);

describe("German rhymes (bundled index)", () => {
  it("rhymes by sound from the last stressed vowel", () => {
    expect(words("Herz", false)).toEqual(expect.arrayContaining(["Schmerz", "Scherz"]));
    expect(words("Nacht", false)).toContain("Mitternacht");
    expect(words("Zeit", false)).toEqual(expect.arrayContaining(["weit", "Kleid"]));
  });

  it("hears final devoicing: Rad rhymes with Rat", () => {
    expect(words("Rad", false)).toContain("Rat");
  });

  it("keeps vowel length apart: Leben is not a rhyme for lieben", () => {
    expect(words("lieben", false)).not.toContain("Leben");
  });

  it("finds near rhymes that are not perfect ones", () => {
    const near = words("Leben", true);
    expect(near).toContain("wegen");
    expect(near).not.toContain("geben");
  });

  it("counts syllables and returns nothing for unknown words", () => {
    expect(germanRhymes("Herz", false)[0].numSyllables).toBe(1);
    expect(germanRhymes("Quxzwort", false)).toEqual([]);
  });
});

describe("OpenThesaurus", () => {
  const payload = {
    synsets: [
      {
        terms: [{ term: "Liebe" }, { term: "Zuneigung" }, { term: "Bindung (zu jemandem)" }, { term: "völlige Zuwendung zu jemandem ganz" }, { term: "Herz..." }, { term: "hält alles zusammen" }, { term: "Rotes Kreuz" }],
        supersynsets: [[{ term: "Gefühl" }]],
        subsynsets: [[{ term: "Jugendliebe" }], [{ term: "Elternliebe" }]],
      },
      { terms: [{ term: "Zuneigung" }, { term: "Hingabe" }] },
    ],
  };

  it("serves synonyms, broader and narrower terms without the word itself", () => {
    expect(parseOpenThesaurus(payload, "similar", "Liebe").map((s) => s.word)).toEqual(["Zuneigung", "Bindung", "Rotes Kreuz", "Hingabe"]);
    expect(parseOpenThesaurus(payload, "related", "Liebe").map((s) => s.word)).toEqual(["Gefühl"]);
    expect(parseOpenThesaurus(payload, "kinds", "Liebe").map((s) => s.word)).toEqual(["Jugendliebe", "Elternliebe"]);
  });
});

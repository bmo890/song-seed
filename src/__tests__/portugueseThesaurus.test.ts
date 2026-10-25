import { portugueseMeanings } from "../domain/portugueseThesaurus";

const words = (word: string, mode: Parameters<typeof portugueseMeanings>[1]) =>
  portugueseMeanings(word, mode).map((result) => result.word);

describe("Portuguese thesaurus (bundled OpenWordNet-PT)", () => {
  it("finds synonyms, common words first", () => {
    const similar = words("casa", "similar");
    expect(similar).toEqual(expect.arrayContaining(["lar", "morada"]));
    expect(similar.indexOf("lar")).toBeLessThan(similar.indexOf("morada"));
  });

  it("finds parts and kinds", () => {
    expect(words("casa", "parts")).toEqual(expect.arrayContaining(["cozinha", "quarto"]));
    expect(words("carro", "kinds")).toContain("táxi");
  });

  it("never returns the word itself, and nothing for unknown words", () => {
    expect(words("casa", "similar")).not.toContain("casa");
    expect(portugueseMeanings("xyzpalavra", "similar")).toEqual([]);
  });
});

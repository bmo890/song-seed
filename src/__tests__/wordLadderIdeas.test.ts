import {
  ideaBank,
  randomPlaceIdea,
  randomRoleIdea,
  suggestNouns,
  suggestVerbs,
  type IdeaLang,
} from "../domain/wordLadderIdeas";

const LANGS: IdeaLang[] = ["en", "he"];

/** How many distinct pools any single word shows up in — the cross-category
 * repetition we're trying to minimize. */
function overlapStats(pools: { seed: string; words: string[] }[]) {
  const freq = new Map<string, number>();
  for (const pool of pools) {
    for (const word of new Set(pool.words.map((w) => w.toLowerCase()))) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  let maxFreq = 0;
  let repeated = 0;
  for (const count of freq.values()) {
    maxFreq = Math.max(maxFreq, count);
    if (count > 1) repeated++;
  }
  return { distinct: freq.size, repeated, maxFreq, repeatRate: repeated / freq.size };
}

describe("word ladder ideas dataset", () => {
  for (const lang of LANGS) {
    describe(`[${lang}]`, () => {
      const bank = ideaBank(lang);

      it("has a broad set of seeds with generous pools", () => {
        expect(bank.roles.length).toBeGreaterThanOrEqual(28);
        expect(bank.places.length).toBeGreaterThanOrEqual(28);
        for (const idea of [...bank.roles, ...bank.places]) {
          expect(idea.words.length).toBeGreaterThanOrEqual(12);
          expect(new Set(idea.words.map((w) => w.toLowerCase())).size).toBe(idea.words.length); // no in-pool dupes
        }
      });

      it("has no duplicate seeds", () => {
        expect(new Set(bank.roles.map((i) => i.seed)).size).toBe(bank.roles.length);
        expect(new Set(bank.places.map((i) => i.seed)).size).toBe(bank.places.length);
      });

      it("keeps cross-seed word repetition low", () => {
        const verbs = overlapStats(bank.roles);
        const nouns = overlapStats(bank.places);
        // No word may appear in more than 4 pools, and the large majority are unique.
        expect(verbs.maxFreq).toBeLessThanOrEqual(4);
        expect(nouns.maxFreq).toBeLessThanOrEqual(4);
        // Most words are unique to one pool; a modest overlap on truly common
        // craft-verbs is acceptable ("minimum as much as we can").
        expect(verbs.repeatRate).toBeLessThan(0.25);
        expect(nouns.repeatRate).toBeLessThan(0.15);
      });

      it("re-rolling never lands on the current seed", () => {
        const role = bank.roles[0].seed;
        const place = bank.places[0].seed;
        for (let i = 0; i < 50; i++) {
          expect(randomRoleIdea(lang, role).seed).not.toBe(role);
          expect(randomPlaceIdea(lang, place).seed).not.toBe(place);
        }
      });

      it("suggestions come from the matched seed's own pool and skip existing words", () => {
        const role = bank.roles[0];
        const skip = role.words[0];
        const picks = suggestVerbs(lang, role.seed, [skip], 4);
        expect(picks.length).toBe(4);
        for (const verb of picks) {
          expect(role.words).toContain(verb);
          expect(verb.toLowerCase()).not.toBe(skip.toLowerCase());
        }
      });
    });
  }

  it("a custom seed still gets suggestions", () => {
    expect(suggestNouns("en", "my weird spaceship", [], 4).length).toBe(4);
    expect(suggestVerbs("he", "משהו מוזר", [], 3).length).toBe(3);
  });
});

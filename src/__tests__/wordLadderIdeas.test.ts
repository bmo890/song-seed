import {
  ALIASES,
  EVERYDAY_NOUNS,
  EVERYDAY_VERBS,
  ideaBank,
  matchSeed,
  randomPlaceIdea,
  randomRoleIdea,
  suggestNouns,
  suggestVerbs,
  type IdeaLang,
} from "../domain/wordLadderIdeas";

const LANGS: IdeaLang[] = ["en", "he", "es", "de", "pt"];

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

describe("typed seeds (founder, 2026-10-19)", () => {
  const verbsOf = (lang: IdeaLang, seed: string) => ideaBank(lang).roles.find((idea) => idea.seed === seed)!.words;
  const placesOf = (lang: IdeaLang, seed: string) => ideaBank(lang).places.find((idea) => idea.seed === seed)!.words;
  const allFrom = (picks: string[], pool: string[]) => picks.length > 0 && picks.every((word) => pool.includes(word));

  it.each([
    ["Florist", "florist"],
    ["  florists ", "florist"],
    ["a florist", "florist"],
    ["the baker", "baker"],
    ["florsit", "florist"], // two letters swapped
    ["electrican", "electrician"], // one letter missing
    ["Cop", "police officer"],
    ["taxi driver", "driver"],
    ["grave digger", "gravedigger"],
    ["Waitress", "waiter"],
  ])("%s finds the %s list", (typed, seed) => {
    expect(matchSeed("en", "roles", typed)?.seed).toBe(seed);
    expect(allFrom(suggestVerbs("en", typed, [], 4), verbsOf("en", seed))).toBe(true);
  });

  it.each([
    ["הנגר", "נגר"],
    ["צלמת", "צלם"],
    ["קופאית", "קופאי"],
    ["מלצרית", "מלצר"],
    ["דייגים", "דייג"],
    ["שף", "טבח"],
    ["עורכת דין", "עורך דין"],
  ])("%s finds the %s list", (typed, seed) => {
    expect(matchSeed("he", "roles", typed)?.seed).toBe(seed);
  });

  it("finds places typed the same loose way", () => {
    expect(matchSeed("en", "places", "The Kitchen")?.seed).toBe("kitchen");
    expect(matchSeed("en", "places", "gym")?.seed).toBe("gymnasium");
    expect(matchSeed("he", "places", "המטבח")?.seed).toBe("מטבח");
    expect(allFrom(suggestNouns("en", "kitchens", [], 4), placesOf("en", "kitchen"))).toBe(true);
  });

  it("looks in the other language too", () => {
    expect(allFrom(suggestVerbs("he", "florist", [], 4), verbsOf("en", "florist"))).toBe(true);
    expect(allFrom(suggestVerbs("en", "נגר", [], 4), verbsOf("he", "נגר"))).toBe(true);
  });

  it("an unlisted job gets everyday words, never another job's list", () => {
    for (let i = 0; i < 30; i++) {
      expect(matchSeed("en", "roles", "astronaut")).toBeNull();
      expect(allFrom(suggestVerbs("en", "astronaut", [], 4), EVERYDAY_VERBS.en)).toBe(true);
      expect(allFrom(suggestNouns("en", "my weird spaceship", [], 4), EVERYDAY_NOUNS.en)).toBe(true);
      expect(allFrom(suggestVerbs("he", "אסטרונאוט", [], 4), EVERYDAY_VERBS.he)).toBe(true);
      // The script of what was typed picks the everyday language.
      expect(allFrom(suggestVerbs("he", "astronaut", [], 4), EVERYDAY_VERBS.en)).toBe(true);
    }
  });

  it("every alias points at a listed seed and never at two", () => {
    for (const lang of LANGS) {
      const bank = ideaBank(lang);
      const seeds = new Set([...bank.roles, ...bank.places].map((idea) => idea.seed));
      const seen = new Map<string, string>();
      for (const [seed, aliases] of Object.entries(ALIASES[lang])) {
        expect(seeds.has(seed)).toBe(true);
        for (const alias of aliases) {
          expect(seeds.has(alias)).toBe(false);
          expect(seen.get(alias) ?? seed).toBe(seed);
          seen.set(alias, seed);
        }
      }
    }
  });
});

describe("German seed matching", () => {
  it.each([
    ["Bäcker", "bäcker"],
    ["baecker", "bäcker"],
    ["die Bäckerin", "bäcker"],
    ["Bäckerinnen", "bäcker"],
    ["Fleischer", "metzger"],
  ])("%s finds %s", (typed, seed) => {
    expect(matchSeed("de", "roles", typed)?.seed).toBe(seed);
  });
});

describe("Portuguese seed matching", () => {
  it.each([
    ["Padeiro", "roles", "padeiro"],
    ["a padeira", "roles", "padeiro"],
    ["padeiros", "roles", "padeiro"],
    ["empregado de mesa", "roles", "garçom"],
    ["na cozinha", "places", "cozinha"],
    ["quintais", "places", "quintal"],
  ] as const)("%s finds %s", (typed, kind, seed) => {
    expect(matchSeed("pt", kind, typed)?.seed).toBe(seed);
  });
});

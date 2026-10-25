import { isPublicDomainEverywhere } from "../magpie";
import { CURATED_BOOKS } from "../magpieBooks";

const now = new Date(2026, 9, 25);

describe("isPublicDomainEverywhere", () => {
  it("lets through authors dead 70 full years", () => {
    expect(isPublicDomainEverywhere({ authors: [{ birth_year: 1821, death_year: 1881 }] }, now)).toBe(true);
    expect(isPublicDomainEverywhere({ authors: [{ birth_year: 1880, death_year: 1955 }] }, now)).toBe(true);
  });

  it("keeps out authors and translators who died in the last 70 years", () => {
    expect(isPublicDomainEverywhere({ authors: [{ birth_year: 1868, death_year: 1963 }] }, now)).toBe(false);
    expect(
      isPublicDomainEverywhere(
        { authors: [{ birth_year: 1826, death_year: 1890 }], translators: [{ birth_year: 1887, death_year: 1972 }] },
        now
      )
    ).toBe(false);
  });

  it("treats a dateless translator as possibly living", () => {
    expect(isPublicDomainEverywhere({ authors: [{ death_year: 1924 }], translators: [{}] }, now)).toBe(false);
  });

  it("lets anonymous or ancient authors through, not recent dateless ones", () => {
    expect(isPublicDomainEverywhere({ authors: [] }, now)).toBe(true);
    expect(isPublicDomainEverywhere({ authors: [{}] }, now)).toBe(true);
    expect(isPublicDomainEverywhere({ authors: [{ birth_year: 1900 }] }, now)).toBe(false);
  });
});

describe("curated shelf", () => {
  it("leaves out the books still in copyright outside the US", () => {
    const ids = CURATED_BOOKS.map((book) => book.id);
    for (const id of [408, 500, 5200, 7849]) expect(ids).not.toContain(id);
  });
});

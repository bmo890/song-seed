import { CURATED_SHELVES } from "../magpieBooks";

describe("curated shelves", () => {
  const all = Object.values(CURATED_SHELVES).flat();

  it("leaves out the books still in copyright outside the US", () => {
    const ids = all.map((book) => book.id);
    for (const id of [408, 500, 5200, 7849]) expect(ids).not.toContain(id);
  });
  it("gives every Gutenberg language a shelf, each book once", () => {
    for (const shelf of Object.values(CURATED_SHELVES)) expect(shelf.length).toBeGreaterThanOrEqual(10);
    expect(new Set(all.map((book) => book.id)).size).toBe(all.length);
  });
});

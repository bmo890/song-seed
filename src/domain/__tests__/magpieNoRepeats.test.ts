import { CURATED_SHELVES, EMPTY_ROTATION, nextShelfBook, type ShelfRotation } from "../magpieBooks";
import { pickWindow } from "../magpie";

// Founder, 2026-11-18: "shouldn't see the same ones over and over again".

function draw(language: "en" | "pt", count: number) {
  let rotation: ShelfRotation = EMPTY_ROTATION;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const next = nextShelfBook(language, rotation);
    rotation = next.rotation;
    ids.push(next.book.id);
  }
  return ids;
}

test("every book on a shelf comes once before any comes back", () => {
  for (const language of ["en", "pt"] as const) {
    const size = CURATED_SHELVES[language].length;
    const ids = draw(language, size * 3);
    for (let round = 0; round < 3; round++) {
      expect(new Set(ids.slice(round * size, (round + 1) * size)).size).toBe(size);
    }
  }
});

test("a book never comes back within six draws, even across rounds", () => {
  for (let trial = 0; trial < 50; trial++) {
    const ids = draw("pt", CURATED_SHELVES.pt.length * 3);
    ids.forEach((id, at) => {
      expect(ids.slice(at + 1, at + 6)).not.toContain(id);
    });
  }
});

test("each round comes in its own order", () => {
  const size = CURATED_SHELVES.en.length;
  const ids = draw("en", size * 2);
  expect(ids.slice(size)).not.toEqual(ids.slice(0, size));
});

test("a new page of a book stays clear of the pages already shown", () => {
  const size = 700_000;
  const seen: number[] = [];
  for (let i = 0; i < 40; i++) {
    const { start } = pickWindow(size, seen);
    for (const other of seen) expect(Math.abs(other - start)).toBeGreaterThanOrEqual(3000);
    seen.push(start);
  }
});

test("a book read through still gives a page, the one farthest from the rest", () => {
  const size = 20_000; // middle band ≈ 3 pages
  const seen = [2000, 5000, 8000, 11000];
  const { start } = pickWindow(size, seen, () => 0.5);
  expect(start).toBeGreaterThanOrEqual(2000);
});

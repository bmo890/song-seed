import { spanNeighbors } from "../domain/spanNeighbors";

describe("spanNeighbors", () => {
  const spans = [
    { id: "a", startMs: 0, endMs: 4000 },
    { id: "b", startMs: 5000, endMs: 8000 },
    { id: "c", startMs: 12000, endMs: 15000 },
  ];

  it("finds the previous end and the next start", () => {
    expect(spanNeighbors(spans, spans[1])).toEqual({ prevEndMs: 4000, nextStartMs: 12000 });
  });

  it("has no previous for the first span and no next for the last", () => {
    expect(spanNeighbors(spans, spans[0])).toEqual({ prevEndMs: null, nextStartMs: 5000 });
    expect(spanNeighbors(spans, spans[2])).toEqual({ prevEndMs: 8000, nextStartMs: null });
  });

  it("takes the latest end when earlier spans overlap", () => {
    const overlapping = [...spans, { id: "d", startMs: 1000, endMs: 6000 }];
    expect(spanNeighbors(overlapping, spans[2]).prevEndMs).toBe(8000);
    expect(spanNeighbors(overlapping, { id: "x", startMs: 5500, endMs: 9000 }).prevEndMs).toBe(8000);
  });
});

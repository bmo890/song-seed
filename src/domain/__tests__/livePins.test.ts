import { placeLivePins } from "../livePins";

const pin = (atMs: number, label = "") => ({ id: `pin-${atMs}`, label, atMs });

test("a plain take keeps its pins where they were dropped", () => {
  expect(placeLivePins([pin(1200), pin(5000, "chorus")], {})).toEqual([pin(1200), { ...pin(5000, "chorus") }]);
});

test("a count-in take's pins move back by the trimmed count-in", () => {
  // 1 bar at 92 BPM ≈ 2609 ms of count-in, trimmed at save.
  const placed = placeLivePins([pin(4609), pin(7000)], { headTrimmedMs: 2609 });
  expect(placed.map((p) => p.atMs)).toEqual([2000, 4391]);
});

test("a punched layer's pins land on the master at the punch", () => {
  // Punch at 60 s, one-bar lead-in trimmed: a pin 1.5 s after the punch is at 61.5 s.
  const placed = placeLivePins([pin(4109, "fill")], { headTrimmedMs: 2609, offsetMs: 60_000 });
  expect(placed).toEqual([{ id: "pin-4109", label: "fill", atMs: 61_500 }]);
});

test("a pin in the lead-in before a punch keeps its place on the master", () => {
  const placed = placeLivePins([pin(1000)], { headTrimmedMs: 2609, offsetMs: 60_000 });
  expect(placed[0].atMs).toBe(58_391);
});

test("pins stay inside the timeline", () => {
  const placed = placeLivePins([pin(500), pin(99_000)], { headTrimmedMs: 1000, durationMs: 30_000 });
  expect(placed.map((p) => p.atMs)).toEqual([0, 30_000]);
});

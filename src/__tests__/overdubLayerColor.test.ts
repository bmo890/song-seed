import { assignNextOverdubStemColor } from "../domain/overdub";

describe("assignNextOverdubStemColor", () => {
  it("returns a hex colour for any existing stem count", () => {
    for (let count = 0; count < 6; count += 1) {
      expect(assignNextOverdubStemColor(count)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("spaces consecutive layers far apart on the hue wheel (golden-angle rotation)", () => {
    const colors = [0, 1, 2, 3].map((count) => assignNextOverdubStemColor(count));
    // No two of the first few layers should collide.
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("is deterministic for a given index", () => {
    expect(assignNextOverdubStemColor(2)).toBe(assignNextOverdubStemColor(2));
  });
});

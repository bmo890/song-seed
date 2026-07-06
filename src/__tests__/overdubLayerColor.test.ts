import { assignNextOverdubStemColor, getOverdubStemColor, withAlpha } from "../overdub";

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

describe("getOverdubStemColor", () => {
  it("prefers the stem's own stored colour", () => {
    expect(getOverdubStemColor({ color: "#123456" }, 5)).toBe("#123456");
  });

  it("falls back to the index-derived colour for stems saved before colour existed", () => {
    expect(getOverdubStemColor({ color: undefined }, 3)).toBe(assignNextOverdubStemColor(3));
  });
});

describe("withAlpha", () => {
  it("converts a hex colour to an rgba string with the given alpha", () => {
    expect(withAlpha("#824f3f", 0.5)).toBe("rgba(130, 79, 63, 0.5)");
  });

  it("handles pure black/white bounds", () => {
    expect(withAlpha("#000000", 1)).toBe("rgba(0, 0, 0, 1)");
    expect(withAlpha("#ffffff", 0)).toBe("rgba(255, 255, 255, 0)");
  });
});

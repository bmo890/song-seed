import { editResultCreatedAt } from "../editResultDates";

describe("editor results keep the recording's date on Replace (07-M3)", () => {
  const march = new Date(2026, 2, 3, 20, 15).getTime();
  const now = new Date(2026, 10, 2, 9).getTime();

  it("a Replace keeps the source take's date, parts a millisecond apart", () => {
    expect(editResultCreatedAt({ replace: true, sourceCreatedAt: march, now, index: 0 })).toBe(march);
    expect(editResultCreatedAt({ replace: true, sourceCreatedAt: march, now, index: 2 })).toBe(march + 2);
  });

  it("Save as new is made now", () => {
    expect(editResultCreatedAt({ replace: false, sourceCreatedAt: march, now, index: 1 })).toBe(now + 1);
  });

  it("falls back to now when the source has no usable date", () => {
    expect(editResultCreatedAt({ replace: true, sourceCreatedAt: Number.NaN, now, index: 0 })).toBe(now);
    expect(editResultCreatedAt({ replace: true, sourceCreatedAt: undefined, now, index: 0 })).toBe(now);
  });
});

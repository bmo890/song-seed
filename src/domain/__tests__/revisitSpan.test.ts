import { dormancySpan } from "../revisit";

describe("dormancySpan", () => {
  it("says days under two weeks", () => {
    expect(dormancySpan(0)).toEqual({ unit: "day", count: 1 });
    expect(dormancySpan(1)).toEqual({ unit: "day", count: 1 });
    expect(dormancySpan(13)).toEqual({ unit: "day", count: 13 });
  });

  it("says weeks under two months, never one week", () => {
    expect(dormancySpan(14)).toEqual({ unit: "week", count: 2 });
    expect(dormancySpan(59)).toEqual({ unit: "week", count: 8 });
  });

  it("says months under a year, never one month", () => {
    expect(dormancySpan(60)).toEqual({ unit: "month", count: 2 });
    expect(dormancySpan(364)).toEqual({ unit: "month", count: 12 });
  });

  it("says years from a year on", () => {
    expect(dormancySpan(365)).toEqual({ unit: "year", count: 1 });
    expect(dormancySpan(800)).toEqual({ unit: "year", count: 2 });
  });
});

// A zone with daylight saving: the bug only shows after the spring change.
process.env.TZ = "America/New_York";

import { buildActivityHeatmapMatrix } from "../activity";

describe("activity heatmap month labels", () => {
  it("sit over the week that holds the first of their month, all year", () => {
    for (const year of [2025, 2026, 2027]) {
      const { weeks, monthMarkers } = buildActivityHeatmapMatrix(year);
      for (const marker of monthMarkers) {
        const first = new Date(year, marker.month, 1);
        const week = weeks[marker.weekIndex]!;
        const holdsFirst = week.some((dayTs) => {
          const day = new Date(dayTs);
          return day.getFullYear() === year && day.getMonth() === marker.month && day.getDate() === 1;
        });
        expect({ year, month: marker.month, holdsFirst }).toEqual({ year, month: marker.month, holdsFirst: true });
        expect(first.getMonth()).toBe(marker.month);
      }
    }
  });
});

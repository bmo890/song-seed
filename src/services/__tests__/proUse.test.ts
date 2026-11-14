const mockStore = new Map<string, string>();
jest.mock("../freeMonthClock", () => ({
  readDurable: async (key: string) => mockStore.get(key) ?? null,
  writeDurable: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));

const MIN = 60 * 1000;

describe("what was used in the free month", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.resetModules();
  });

  it("counts a sitting, not a tap", () => {
    const use = require("../proUse");
    const t0 = 1_800_000_000_000;
    // Ten nudges of speed in one sitting are one use of the practice tools.
    for (let i = 0; i < 10; i += 1) use.noteProUse("practice-suite", t0 + i * 1000);
    expect(use.proUseRanking()).toEqual([{ group: "practice", count: 1 }]);
    // The editor's Speed & pitch tab is the same group, so the same sitting.
    use.noteProUse("full-editor", t0 + 5 * MIN);
    expect(use.proUseRanking()).toEqual([{ group: "practice", count: 1 }]);
    // Half an hour later it is another sitting.
    use.noteProUse("practice-suite", t0 + use.SITTING_MS);
    expect(use.proUseRanking()).toEqual([{ group: "practice", count: 2 }]);
    // Another group has its own clock.
    use.noteProUse("word-finder-full", t0 + use.SITTING_MS + 1000);
    expect(use.proUseRanking().map((entry: { group: string }) => entry.group)).toEqual(["practice", "wordFinder"]);
  });

  it("ignores a gate the Pro page does not name", () => {
    const use = require("../proUse");
    use.noteProUse("workspaces");
    use.noteProUse("daw-export");
    use.noteProUse("archive-offload");
    expect(use.proUseRanking()).toEqual([]);
  });

  it("ranks most used first, three at most, and survives a relaunch", async () => {
    const use = require("../proUse");
    const t0 = 1_800_000_000_000;
    const sittings = (feature: string, n: number) => {
      for (let i = 0; i < n; i += 1) use.noteProUse(feature, t0 + i * use.SITTING_MS);
    };
    sittings("word-finder-full", 5);
    sittings("overdub-layers", 2);
    sittings("stage-tools", 3);
    sittings("send", 1);
    expect(use.proUseRanking()).toEqual([
      { group: "wordFinder", count: 5 },
      { group: "stage", count: 3 },
      { group: "layers", count: 2 },
    ]);
    await Promise.resolve();

    jest.resetModules();
    const again = require("../proUse");
    expect(again.proUseRanking()).toEqual([]);
    await again.loadProUse();
    expect(again.proUseRanking(6).map((entry: { count: number }) => entry.count)).toEqual([5, 3, 1, 2].sort((a, b) => b - a));
  });

  it("keeps what it has when the stored copy is damaged", async () => {
    const use = require("../proUse");
    use.noteProUse("send");
    mockStore.set("songnook.proUse", "not json");
    await use.loadProUse();
    expect(use.proUseRanking()).toEqual([{ group: "send", count: 1 }]);
  });
});

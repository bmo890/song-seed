const mockStore = new Map<string, string>();
jest.mock("../freeMonthClock", () => ({
  readDurable: async (key: string) => mockStore.get(key) ?? null,
  writeDurable: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
}));

describe("a word game's free tries", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.resetModules();
  });

  it("are spent by starting, kept for good, per game", async () => {
    const tries = require("../sparkTries");
    await tries.loadSparkTries();
    tries.spendSparkTry("cutUp");
    tries.spendSparkTry("cutUp");
    expect(tries.sparkTriesUsed("cutUp")).toBe(2);
    expect(tries.sparkTriesUsed("magpie")).toBe(0);
    await Promise.resolve();

    // A fresh launch (or a reinstall that kept the Keychain) reads them back.
    jest.resetModules();
    const again = require("../sparkTries");
    await again.loadSparkTries();
    expect(again.sparkTriesUsed("cutUp")).toBe(2);
  });

  it("give a try back only for a spark left with nothing written", async () => {
    const tries = require("../sparkTries");
    await tries.loadSparkTries();
    tries.spendSparkTry("wordLadder", "spark-a");
    expect(tries.sparkTriesUsed("wordLadder")).toBe(1);
    // The screen silently discarded the untouched spark: the try returns, once.
    tries.refundSparkTry("spark-a");
    tries.refundSparkTry("spark-a");
    expect(tries.sparkTriesUsed("wordLadder")).toBe(0);
    // A spark that was never on a free try (Pro, the free month, an older one) refunds nothing.
    tries.spendSparkTry("cutUp");
    tries.refundSparkTry("some-other-spark");
    expect(tries.sparkTriesUsed("cutUp")).toBe(1);
    await Promise.resolve();

    // The refund is stored: a fresh launch reads the lowered count, and the open try is
    // forgotten, so a spark that outlives the launch keeps its try spent.
    jest.resetModules();
    const again = require("../sparkTries");
    await again.loadSparkTries();
    expect(again.sparkTriesUsed("wordLadder")).toBe(0);
    again.spendSparkTry("magpie", "spark-b");
    await Promise.resolve();
    jest.resetModules();
    const later = require("../sparkTries");
    await later.loadSparkTries();
    later.refundSparkTry("spark-b");
    expect(later.sparkTriesUsed("magpie")).toBe(1);
  });

  it("never lowers a count when the stored one loads late or is damaged", async () => {
    mockStore.set("songnook.sparkTries", JSON.stringify({ wordLadder: 1 }));
    const tries = require("../sparkTries");
    tries.spendSparkTry("wordLadder");
    tries.spendSparkTry("wordLadder");
    mockStore.set("songnook.sparkTries", JSON.stringify({ wordLadder: 1 }));
    await tries.loadSparkTries();
    expect(tries.sparkTriesUsed("wordLadder")).toBe(2);

    mockStore.set("songnook.sparkTries", "not json");
    await tries.loadSparkTries();
    expect(tries.sparkTriesUsed("wordLadder")).toBe(2);
  });
});

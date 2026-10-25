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

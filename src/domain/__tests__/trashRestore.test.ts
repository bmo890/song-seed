import { parseTrashName, planTrashRestores } from "../trashRestore";

const AUDIO = "file:///docs/songnook/audio";

describe("the trash safety net", () => {
  it("reads the names the trash writes", () => {
    expect(parseTrashName("1792391014265-c87uzg-clip-1792390839897.m4a")).toEqual({
      trashedAt: 1792391014265,
      filename: "clip-1792390839897.m4a",
    });
    expect(parseTrashName("1792391014261-be7i7p-recovered-1792356341049-5shx87s-preview-1.wav")?.filename).toBe(
      "recovered-1792356341049-5shx87s-preview-1.wav"
    );
    expect(parseTrashName("notes.txt")).toBeNull();
  });

  it("brings back a file the library still points at", () => {
    expect(
      planTrashRestores([`${AUDIO}/layer-1.m4a`], ["1790000000000-abc123-layer-1.m4a", "1790000000001-def456-other.m4a"])
    ).toEqual([{ trashName: "1790000000000-abc123-layer-1.m4a", to: `${AUDIO}/layer-1.m4a` }]);
  });

  it("prefers the most recently trashed copy", () => {
    const plan = planTrashRestores(
      [`${AUDIO}/take.m4a`],
      ["1790000000000-aaaaaa-take.m4a", "1795000000000-bbbbbb-take.m4a", "1792000000000-cccccc-take.m4a"]
    );
    expect(plan).toEqual([{ trashName: "1795000000000-bbbbbb-take.m4a", to: `${AUDIO}/take.m4a` }]);
  });

  it("leaves alone what nothing points at, and files it can't match", () => {
    expect(planTrashRestores([], ["1790000000000-abc123-take.m4a"])).toEqual([]);
    expect(planTrashRestores([`${AUDIO}/gone.m4a`], ["1790000000000-abc123-take.m4a", "stray.m4a"])).toEqual([]);
  });

  it("uses each trash entry once", () => {
    const plan = planTrashRestores(
      [`${AUDIO}/take.m4a`, `file:///docs/songnook/preview-audio/take.m4a`],
      ["1790000000000-abc123-take.m4a"]
    );
    expect(plan).toHaveLength(1);
  });
});

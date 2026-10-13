import { moveParcelItem, orderByKeys, sortParcelItemsAz } from "../parcelOrder";

const items = [
  { key: "a", title: "Bridge idea" },
  { key: "b", title: "apple pie" },
  { key: "c", title: "Take 10" },
  { key: "d", title: "Take 2" },
];

describe("moveParcelItem", () => {
  it("moves an item to a new index and clamps the ends", () => {
    expect(moveParcelItem(items, 0, 2).map((i) => i.key)).toEqual(["b", "c", "a", "d"]);
    expect(moveParcelItem(items, 3, 0).map((i) => i.key)).toEqual(["d", "a", "b", "c"]);
    expect(moveParcelItem(items, 3, 9).map((i) => i.key)).toEqual(["a", "b", "c", "d"]);
    expect(moveParcelItem(items, 0, -1)).toBe(items);
    expect(moveParcelItem(items, 7, 0)).toBe(items);
  });
});

describe("sortParcelItemsAz", () => {
  it("sorts by title ignoring case, with numbers in natural order", () => {
    expect(sortParcelItemsAz(items).map((i) => i.key)).toEqual(["b", "a", "d", "c"]);
  });
});

describe("orderByKeys", () => {
  it("applies a chosen order, keeps unnamed items after it, ignores unknown keys", () => {
    const clips = [{ id: "x" }, { id: "y" }, { id: "z" }];
    expect(orderByKeys(clips, ["z", "ghost", "x"], (c) => c.id).map((c) => c.id)).toEqual(["z", "x", "y"]);
    expect(orderByKeys(clips, undefined, (c) => c.id)).toBe(clips);
    expect(orderByKeys(clips, ["y", "y"], (c) => c.id).map((c) => c.id)).toEqual(["y", "x", "z"]);
  });
});

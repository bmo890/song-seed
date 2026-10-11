import { listCompilations } from "../compilationListing";

const received = { senderName: "Dana", receivedAt: 1, transferId: "t" } as never;
const items = [
  { id: "a", title: "Bravo", createdAt: 1, updatedAt: 30 },
  { id: "b", title: "Alpha", createdAt: 3, updatedAt: 10, received },
  { id: "c", title: "Charlie", createdAt: 2, updatedAt: 20 },
];

describe("listCompilations", () => {
  it("defaults to newest-updated first, everything shown", () => {
    expect(listCompilations(items, "all", "updated").map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("filters to mine or received", () => {
    expect(listCompilations(items, "mine", "updated").map((i) => i.id)).toEqual(["a", "c"]);
    expect(listCompilations(items, "received", "updated").map((i) => i.id)).toEqual(["b"]);
  });

  it("sorts by name and by creation", () => {
    expect(listCompilations(items, "all", "name").map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(listCompilations(items, "all", "created").map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("never mutates its input", () => {
    const copy = items.slice();
    listCompilations(items, "all", "name");
    expect(items).toEqual(copy);
  });
});

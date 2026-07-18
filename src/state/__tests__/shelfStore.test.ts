jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { useShelfStore } from "../useShelfStore";
import { SHELF_DEPARTED_LIMIT, SHELF_STAY_MS } from "../../domain/shelf";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function resetShelf() {
  useShelfStore.setState({ entries: [], departed: [] });
}

describe("useShelfStore", () => {
  beforeEach(resetShelf);

  it("setAside adds entries newest-first and skips duplicates via fresh stays", () => {
    const store = useShelfStore.getState();
    store.setAside([{ kind: "idea", id: "a" }], NOW);
    store.setAside([{ kind: "idea", id: "b" }], NOW + 1000);

    let state = useShelfStore.getState();
    expect(state.entries.map((entry) => entry.id)).toEqual(["b", "a"]);

    // Re-shelving an existing item refreshes its stay instead of duplicating.
    store.setAside([{ kind: "idea", id: "a" }], NOW + 2000);
    state = useShelfStore.getState();
    expect(state.entries.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(state.entries[0]!.expiresAt).toBe(NOW + 2000 + SHELF_STAY_MS);
    expect(state.entries).toHaveLength(2);
  });

  it("keepLonger restarts the stay and counts the keep", () => {
    useShelfStore.getState().setAside([{ kind: "idea", id: "a" }], NOW);
    useShelfStore.getState().keepLonger("idea:a", NOW + 6 * DAY_MS);

    const entry = useShelfStore.getState().entries[0]!;
    expect(entry.expiresAt).toBe(NOW + 6 * DAY_MS + SHELF_STAY_MS);
    expect(entry.keepCount).toBe(1);
  });

  it("leaveShelf moves the entry to the departed buffer", () => {
    useShelfStore.getState().setAside([{ kind: "idea", id: "a" }], NOW);
    useShelfStore.getState().leaveShelf("idea:a", NOW + 1000);

    const state = useShelfStore.getState();
    expect(state.entries).toHaveLength(0);
    expect(state.departed).toEqual([{ key: "idea:a", kind: "idea", id: "a", leftAt: NOW + 1000 }]);
  });

  it("reshelve returns a departed item with a fresh stay", () => {
    useShelfStore.getState().setAside([{ kind: "idea", id: "a" }], NOW);
    useShelfStore.getState().leaveShelf("idea:a", NOW + 1000);
    useShelfStore.getState().reshelve("idea:a", NOW + 2000);

    const state = useShelfStore.getState();
    expect(state.departed).toHaveLength(0);
    expect(state.entries[0]!.id).toBe("a");
    expect(state.entries[0]!.expiresAt).toBe(NOW + 2000 + SHELF_STAY_MS);
    expect(state.entries[0]!.keepCount).toBe(0);
  });

  it("setAside pulls an item straight out of the departed buffer", () => {
    useShelfStore.getState().setAside([{ kind: "idea", id: "a" }], NOW);
    useShelfStore.getState().leaveShelf("idea:a", NOW + 1000);
    useShelfStore.getState().setAside([{ kind: "idea", id: "a" }], NOW + 2000);

    const state = useShelfStore.getState();
    expect(state.departed).toHaveLength(0);
    expect(state.entries.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("sweep moves expired entries out and respects the buffer cap", () => {
    const store = useShelfStore.getState();
    for (let i = 0; i < SHELF_DEPARTED_LIMIT + 2; i++) {
      store.setAside([{ kind: "idea", id: `item-${i}` }], NOW + i);
    }
    // Everything expires; the sweep should keep only the cap's worth.
    useShelfStore.getState().sweep(NOW + SHELF_STAY_MS + DAY_MS);

    const state = useShelfStore.getState();
    expect(state.entries).toHaveLength(0);
    expect(state.departed).toHaveLength(SHELF_DEPARTED_LIMIT);
    // Newest departures survive (later setAside → later expiresAt → newer leftAt).
    expect(state.departed[0]!.id).toBe(`item-${SHELF_DEPARTED_LIMIT + 1}`);
  });

  it("sweep is a no-op when nothing has expired", () => {
    useShelfStore.getState().setAside([{ kind: "idea", id: "a" }], NOW);
    const before = useShelfStore.getState().entries;
    useShelfStore.getState().sweep(NOW + 1000);
    expect(useShelfStore.getState().entries).toBe(before);
  });
});

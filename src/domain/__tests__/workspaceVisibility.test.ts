jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  isReceivedWorkspace,
  personalWorkspaces,
  receivedPackages,
  unopenedReceivedCount,
} from "../workspaceVisibility";
import { normalizeWorkspaces } from "../../state/dataSlice";
import type { Workspace } from "../../types";

function ws(id: string, overrides: Partial<Workspace> = {}): Workspace {
  return { id, title: id, collections: [], ideas: [], ...overrides } as Workspace;
}

describe("workspace visibility choke point", () => {
  const mine = ws("mine");
  const legacy = ws("legacy", { origin: "personal" });
  const pkgOld = ws("pkg-old", {
    origin: "received",
    received: {
      senderName: "Ben",
      senderUserId: null,
      transferId: "t1",
      receivedAt: 100,
      shareKind: "setlist",
      shareTitle: "Gig",
    },
  });
  const pkgNew = ws("pkg-new", {
    origin: "received",
    received: {
      senderName: null,
      senderUserId: null,
      transferId: null,
      receivedAt: 200,
      shareKind: "collection",
      shareTitle: "Demos",
    },
  });

  it("splits personal from received; received sorts newest first", () => {
    const all = [mine, pkgOld, legacy, pkgNew];
    expect(personalWorkspaces(all).map((w) => w.id)).toEqual(["mine", "legacy"]);
    expect(receivedPackages(all).map((w) => w.id)).toEqual(["pkg-new", "pkg-old"]);
    expect(isReceivedWorkspace(pkgOld)).toBe(true);
    expect(isReceivedWorkspace(mine)).toBe(false);
  });

  it("normalization sanitizes garbage origins and orphaned received meta", () => {
    const normalized = normalizeWorkspaces([
      ws("bad", { origin: "banana" as never }),
      ws("orphan-meta", { received: pkgOld.received }), // meta without origin
      pkgNew,
    ]);
    expect(normalized[0]!.origin).toBeUndefined();
    expect(normalized[1]!.origin).toBeUndefined();
    expect(normalized[1]!.received).toBeUndefined();
    expect(normalized[2]!.origin).toBe("received");
    expect(normalized[2]!.received?.shareKind).toBe("collection");
    // Personal-by-default: absent origin means personal everywhere.
    expect(personalWorkspaces(normalized).map((w) => w.id)).toEqual(["bad", "orphan-meta"]);
  });
});

describe("unopenedReceivedCount", () => {
  const meta = {
    senderName: "Dana",
    senderUserId: null,
    transferId: "t9",
    receivedAt: 5,
    shareKind: "clips" as const,
    shareTitle: "Riffs",
  };
  it("counts received packages without an openedAt stamp", () => {
    const list = [
      ws("mine"),
      ws("new", { origin: "received", received: meta }),
      ws("seen", { origin: "received", received: { ...meta, openedAt: 9 } }),
    ];
    expect(unopenedReceivedCount(list)).toBe(1);
  });

  it("is zero with no packages", () => {
    expect(unopenedReceivedCount([ws("mine")])).toBe(0);
  });
});

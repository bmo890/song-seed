import { packOverdubLaneRows, type OverdubLayerLane } from "../components/common/OverdubLayerLanes";

function lane(id: string, offsetMs: number, durationMs: number): OverdubLayerLane {
  return { id, title: id, offsetMs, durationMs, color: "#824f3f", isMuted: false };
}

describe("packOverdubLaneRows", () => {
  it("keeps non-overlapping spot layers on one row", () => {
    const { rowByLaneId, rowCount } = packOverdubLaneRows([
      lane("verse", 0, 5000),
      lane("chorus", 20000, 5000),
    ]);
    expect(rowCount).toBe(1);
    expect(rowByLaneId.verse).toBe(0);
    expect(rowByLaneId.chorus).toBe(0);
  });

  it("splits a full-length layer off from an overlapping spot layer", () => {
    // The screenshot case: a full-length layer plus a half-length one both from 0.
    const { rowByLaneId, rowCount } = packOverdubLaneRows([
      lane("full", 0, 20000),
      lane("layer3", 0, 9000),
    ]);
    expect(rowCount).toBe(2);
    expect(rowByLaneId.full).not.toBe(rowByLaneId.layer3);
  });

  it("packs a non-overlapping sliver back onto the spot layer's row", () => {
    const { rowByLaneId, rowCount } = packOverdubLaneRows([
      lane("full", 0, 20000),
      lane("layer3", 0, 9000),
      lane("tail", 18000, 2000),
    ]);
    // full on its own row; layer3 + tail share the other (they don't overlap).
    expect(rowCount).toBe(2);
    expect(rowByLaneId.layer3).toBe(rowByLaneId.tail);
    expect(rowByLaneId.full).not.toBe(rowByLaneId.layer3);
  });

  it("tolerates a small edge overlap on the same row", () => {
    // 1s overlap between two ~10s bars — under the 20% threshold, so they share.
    const { rowCount } = packOverdubLaneRows([
      lane("a", 0, 10000),
      lane("b", 9000, 10000),
    ]);
    expect(rowCount).toBe(1);
  });

  it("uses three rows when three layers all overlap", () => {
    const { rowCount } = packOverdubLaneRows([
      lane("a", 0, 20000),
      lane("b", 0, 20000),
      lane("c", 0, 20000),
    ]);
    expect(rowCount).toBe(3);
  });
});

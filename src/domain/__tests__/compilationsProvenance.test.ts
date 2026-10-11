import { hasFromOthers, isFromOthers } from "../compilationsProvenance";

const meta = {
  senderName: "Dana",
  senderUserId: null,
  transferId: "t1",
  receivedAt: 1,
  shareKind: "setlist" as const,
  shareTitle: "Rooftop",
};
type Row = { id: string; title: string; received?: typeof meta };
const mine: Row = { id: "a", title: "Friday" };
const theirs: Row = { id: "b", title: "Rooftop", received: meta };

describe("compilations provenance", () => {
  it("tells a received compilation from one of your own", () => {
    expect(isFromOthers(mine)).toBe(false);
    expect(isFromOthers(theirs)).toBe(true);
    expect(hasFromOthers([mine])).toBe(false);
    expect(hasFromOthers([mine, theirs])).toBe(true);
  });
});

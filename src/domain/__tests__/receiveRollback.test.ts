import { createdByAttempt, idsFromTransfer } from "../receiveRollback";

describe("a failed receive rolls back only its own attempt (04-M4)", () => {
  const kept = { id: "set-kept", received: { transferId: "t1" } };
  const other = { id: "set-other", received: { transferId: "t2" } };

  it("keeps the setlist an earlier receive of the same link left behind", () => {
    const before = idsFromTransfer([kept, other], "t1");
    const now = [kept, other, { id: "set-new", received: { transferId: "t1" } }];
    expect(createdByAttempt(now, "t1", before)).toEqual(["set-new"]);
  });

  it("is empty when the attempt created nothing", () => {
    const before = idsFromTransfer([kept], "t1");
    expect(createdByAttempt([kept], "t1", before)).toEqual([]);
  });
});

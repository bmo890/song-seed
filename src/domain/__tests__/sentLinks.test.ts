import {
  SENT_LINK_PRUNE_GRACE_MS,
  isSentLinkExpired,
  pruneExpiredSentLinks,
  sanitizeSentLinks,
  upsertSentLink,
  type SentLink,
} from "../sentLinks";

const link = (over: Partial<SentLink> = {}): SentLink => ({
  transferId: "t_1",
  shareUrl: "https://send.songnook.app/t/t_1",
  title: "Set",
  kind: "setlist",
  createdAt: 1000,
  expiresAt: 2000,
  itemCount: 1,
  ...over,
});

describe("sentLinks", () => {
  it("upsert dedupes by transferId, newest first", () => {
    const a = link({ transferId: "t_1", title: "A" });
    const b = link({ transferId: "t_2", title: "B" });
    let list = upsertSentLink([a], b);
    expect(list.map((l) => l.transferId)).toEqual(["t_2", "t_1"]);
    // Re-sharing t_1 replaces the old record and moves it to the front.
    list = upsertSentLink(list, link({ transferId: "t_1", title: "A2" }));
    expect(list.map((l) => l.transferId)).toEqual(["t_1", "t_2"]);
    expect(list[0].title).toBe("A2");
    expect(list).toHaveLength(2);
  });

  it("expiry + prune respect the grace window", () => {
    const l = link({ expiresAt: 2000 });
    expect(isSentLinkExpired(l, 1999)).toBe(false);
    expect(isSentLinkExpired(l, 2000)).toBe(true);
    // Still kept during grace, pruned after.
    expect(pruneExpiredSentLinks([l], 2000 + SENT_LINK_PRUNE_GRACE_MS - 1)).toHaveLength(1);
    expect(pruneExpiredSentLinks([l], 2000 + SENT_LINK_PRUNE_GRACE_MS + 1)).toHaveLength(0);
  });

  it("sanitize drops malformed rows and dedupes", () => {
    const out = sanitizeSentLinks([
      link({ transferId: "t_1" }),
      link({ transferId: "t_1" }), // dup
      { transferId: "", shareUrl: "x", kind: "setlist", createdAt: 1, expiresAt: 2 }, // no id
      { transferId: "t_9", shareUrl: "u", kind: "not-a-kind", createdAt: 1, expiresAt: 2 }, // bad kind
      "garbage",
    ]);
    expect(out.map((l) => l.transferId)).toEqual(["t_1"]);
  });
});

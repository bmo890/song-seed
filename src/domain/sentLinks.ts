/**
 * Sent-links outbox — the local record of transfer links this device created, so
 * a link is never lost after you send it. Local-only in v1; keyed by transferId
 * (dedupe on re-share), so when server-backed "my transfers" arrives (accounts,
 * R3) this becomes its cache — a merge, not a migration.
 *
 * Mirrors the Shelf's shape: entries self-clean, so the outbox structurally can't
 * become a graveyard. Expired links stop being usable server-side; we keep them a
 * short grace period (greyed out) then prune.
 */
import type { ShareKind } from "../types";

export type SentLink = {
  /** Transfer identity + dedupe key. */
  transferId: string;
  shareUrl: string;
  title: string;
  kind: ShareKind;
  /** Back-reference to the entity that was shared (setlist/songbook id), so a
   *  detail view can show "Link active · N days left". Absent for ad-hoc sends. */
  entityId?: string;
  createdAt: number;
  expiresAt: number;
  itemCount: number;
};

/** Keep expired entries visible (greyed out) this long before pruning. */
export const SENT_LINK_PRUNE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export const isSentLinkExpired = (link: SentLink, now: number): boolean => link.expiresAt <= now;

/** Drop entries that expired more than the grace window ago. Idempotent. */
export function pruneExpiredSentLinks(links: SentLink[], now: number): SentLink[] {
  return links.filter((link) => link.expiresAt > now - SENT_LINK_PRUNE_GRACE_MS);
}

/** Newest first, deduped by transferId (a re-share replaces the old record). */
export function upsertSentLink(links: SentLink[], next: SentLink): SentLink[] {
  const rest = links.filter((link) => link.transferId !== next.transferId);
  return [next, ...rest];
}

const VALID_KINDS: ShareKind[] = [
  "setlist",
  "songbook",
  "collection",
  "workspace",
  "clips",
  "library",
];

export function sanitizeSentLinks(value: unknown): SentLink[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: SentLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const c = item as Partial<SentLink>;
    if (typeof c.transferId !== "string" || !c.transferId) continue;
    if (typeof c.shareUrl !== "string" || !c.shareUrl) continue;
    if (!c.kind || !VALID_KINDS.includes(c.kind)) continue;
    if (!Number.isFinite(c.createdAt) || !Number.isFinite(c.expiresAt)) continue;
    if (seen.has(c.transferId)) continue;
    seen.add(c.transferId);
    out.push({
      transferId: c.transferId,
      shareUrl: c.shareUrl,
      title: typeof c.title === "string" ? c.title : "",
      kind: c.kind,
      entityId: typeof c.entityId === "string" ? c.entityId : undefined,
      createdAt: c.createdAt as number,
      expiresAt: c.expiresAt as number,
      itemCount: Number.isFinite(c.itemCount) ? (c.itemCount as number) : 1,
    });
  }
  return out;
}

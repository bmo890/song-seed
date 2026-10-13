/**
 * What a parcel says it is. Mirrors the app's `ShareKind` (src/types.ts) — the
 * same seven words on both sides of the wire. The service never opens a file
 * to check; this is the sender's declaration, echoed to the recipient page and
 * to the app's receive screen so a collection or a workspace reads as one
 * before anything is downloaded. On device the .songnook manifest stays the
 * authority.
 */
export const SHARE_KINDS = [
  "clips",
  "playlist",
  "setlist",
  "songbook",
  "collection",
  "workspace",
  "library",
] as const;

export type ShareKind = (typeof SHARE_KINDS)[number];

/** Unknown, missing or malformed → "clips": a parcel is never refused over its label. */
export function normalizeShareKind(value: unknown): ShareKind {
  return typeof value === "string" && (SHARE_KINDS as readonly string[]).includes(value)
    ? (value as ShareKind)
    : "clips";
}

/** Kinds whose payload is a .songnook package rather than loose audio. */
export function isPackageKind(kind: ShareKind): boolean {
  return kind !== "clips";
}

/** The recipient page's one-line description of what the parcel is. */
export function describeKind(kind: ShareKind): string | null {
  switch (kind) {
    case "playlist":
      return "a playlist, in order";
    case "setlist":
      return "a setlist, in order";
    case "songbook":
      return "a chart book";
    case "collection":
      return "a collection";
    case "workspace":
      return "a whole workspace";
    case "library":
      return "a SongNook library";
    default:
      return null;
  }
}

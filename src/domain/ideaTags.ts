import type { SongIdea } from "../types";

/** The tag-filter member that stands for "carries no tag at all". */
export const UNTAGGED_FILTER_KEY = "untagged";

/**
 * A clip idea's tags are its clips' tags (2026-10-03, founder: tags on clips
 * only). Sketches and songs carry none here — their takes are tagged inside
 * the sketch, where the takes list has its own filter.
 */
export function getClipIdeaTags(idea: SongIdea): string[] {
  if (idea.kind !== "clip") return [];
  const seen = new Set<string>();
  for (const clip of idea.clips) {
    for (const tag of clip.tags ?? []) seen.add(tag);
  }
  return Array.from(seen);
}

/** Empty filter = everything. Otherwise only clip ideas carrying any listed tag
 *  (or none at all, when the filter names `untagged`). */
export function ideaMatchesTagFilter(idea: SongIdea, filter: string[]): boolean {
  if (filter.length === 0) return true;
  if (idea.kind !== "clip") return false;
  const tags = getClipIdeaTags(idea);
  if (tags.length === 0) return filter.includes(UNTAGGED_FILTER_KEY);
  return tags.some((tag) => filter.includes(tag));
}

/** Every tag in use across these ideas' clips, most used first. */
export function collectClipIdeaTagsInUse(ideas: SongIdea[]): string[] {
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    for (const tag of getClipIdeaTags(idea)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

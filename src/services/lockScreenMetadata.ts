import { useStore } from "../state/useStore";

export type ClipLockScreenMetadata = {
  title?: string;
  artist?: string;
  albumTitle?: string;
};

/**
 * Card lines for the native media surface: the clip/take on top, the song
 * (idea) as the artist line — the one subtitle both platforms actually show —
 * and its collection as the album line. For clip-kind ideas the clip and idea
 * titles are often identical; fall back to the collection so the second line
 * stays informative instead of echoing the first.
 *
 * Callers pass whatever idea shape they hold ({id, title} is enough); the
 * collection is resolved from the store.
 */
export function buildClipLockScreenMetadata(
  idea: { id: string; title: string },
  clip: { title?: string }
): ClipLockScreenMetadata {
  const workspace = useStore
    .getState()
    .workspaces.find((candidate) => candidate.ideas.some((i) => i.id === idea.id));
  const collectionId = workspace?.ideas.find((i) => i.id === idea.id)?.collectionId;
  const collectionTitle = workspace?.collections.find((c) => c.id === collectionId)?.title;

  const artist = idea.title === clip.title ? collectionTitle : idea.title;
  return {
    title: clip.title,
    artist,
    albumTitle: collectionTitle,
  };
}

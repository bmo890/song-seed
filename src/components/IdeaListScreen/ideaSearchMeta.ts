import { extractSnippet } from "../../domain/search";
import type { SongIdea } from "../../types";
import type { SearchMeta } from "./types";

export const EMPTY_SEARCH_META: SearchMeta = {
  matches: true,
  title: false,
  notes: false,
  lyrics: false,
  snippet: null,
  snippetField: null,
};

/**
 * Does this idea match the (lower-cased, trimmed) needle, and which line shows why?
 * Lyrics first (most meaningful for a songwriter), then notes; a title match needs
 * no snippet — the highlighted title is the match. The screen model runs this over
 * every idea to filter the list; each row runs it for its own idea to show the line.
 */
export function computeIdeaSearchMeta(idea: SongIdea, needle: string): SearchMeta {
  if (needle.length === 0) return EMPTY_SEARCH_META;
  const titleMatch = idea.title.toLowerCase().includes(needle);
  const notesMatch =
    idea.notes.toLowerCase().includes(needle) ||
    idea.clips.some((clip) => clip.notes.toLowerCase().includes(needle));
  let lyricsMatch = false;
  if (idea.kind === "project" && idea.lyrics?.versions?.length) {
    lyricsMatch = idea.lyrics.versions.some((version) =>
      version.document.lines.some(
        (line) =>
          line.text.toLowerCase().includes(needle) ||
          line.chords.some((chord) => chord.chord.toLowerCase().includes(needle))
      )
    );
  }
  let snippet: string | null = null;
  let snippetField: "notes" | "lyrics" | null = null;
  if (lyricsMatch && idea.kind === "project" && idea.lyrics?.versions?.length) {
    for (const version of idea.lyrics.versions) {
      const line = version.document.lines.find((l) => l.text.toLowerCase().includes(needle));
      if (line) {
        snippet = extractSnippet(line.text, needle);
        snippetField = "lyrics";
        break;
      }
    }
  }
  if (!snippet && notesMatch) {
    const src = idea.notes.toLowerCase().includes(needle)
      ? idea.notes
      : idea.clips.find((clip) => clip.notes.toLowerCase().includes(needle))?.notes ?? "";
    if (src) {
      snippet = extractSnippet(src, needle);
      snippetField = "notes";
    }
  }
  return {
    matches: titleMatch || notesMatch || lyricsMatch,
    title: titleMatch,
    notes: notesMatch,
    lyrics: lyricsMatch,
    snippet,
    snippetField,
  };
}

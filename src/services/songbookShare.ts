import { buildSongbookArchive } from "../domain/songbookExport";
import { exportLibrary } from "./libraryExport";
import type { Songbook, Workspace } from "../types";

/** Exports a songbook as a charts-only Songstead archive (no audio, tiny) and
 *  hands it to the OS share sheet. The receiver imports a real Songbook. Returns
 *  false when the book has no resolvable charts. */
export async function shareSongbookFile(songbook: Songbook, workspaces: Workspace[]): Promise<boolean> {
  const built = buildSongbookArchive(songbook, workspaces);
  if (!built) return false;

  await exportLibrary({
    workspaces: built.workspaces,
    notes: [],
    format: "songstead-archive",
    scope: built.scope,
    songbooks: [built.songbook],
    options: {
      includeFullSongHistory: true, // already trimmed to the referenced charts
      includeNotes: false,
      includeLyrics: true,
      includeHiddenItems: true,
      preserveAllMetadata: true, // keep lyric versions + chord sheets intact
    },
    archiveLabel: songbook.title,
  });
  return true;
}

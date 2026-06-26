import { buildSetlistArchive } from "../setlistExport";
import { exportLibrary } from "./libraryExport";
import type { Setlist, Workspace } from "../types";

/** Exports a setlist as a playable Song Seed archive (selected clips + chosen
 * charts per song, ordered, no version history) and hands it to the OS share
 * sheet. Returns false if the setlist has nothing exportable. */
export async function shareSetlist(setlist: Setlist, workspaces: Workspace[]): Promise<boolean> {
  const built = buildSetlistArchive(setlist, workspaces);
  if (!built) return false;

  await exportLibrary({
    workspaces: built.workspaces,
    notes: [],
    format: "song-seed-archive",
    scope: built.scope,
    options: {
      includeFullSongHistory: true, // we already trimmed to the chosen clips
      includeNotes: false,
      includeLyrics: true,
      includeHiddenItems: true,
      preserveAllMetadata: true, // keep lyric versions + chords + chord sheet
    },
    archiveLabel: setlist.title,
  });
  return true;
}

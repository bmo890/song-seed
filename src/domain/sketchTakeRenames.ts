import type { ClipVersion } from "../types";
import type { LineageRenameTarget } from "./clipLineageTitles";
import { titleFromFileName } from "./fileTitle";
import { isTitleAutoNamed } from "./titleNaming";

/**
 * Which takes should follow a sketch rename (2026-10-13, founder-approved).
 *
 * A sketch's name and its takes' names are separate on purpose — a take can be
 * "Live at the Rooftop". So nothing syncs on its own. But a take that is
 * provably a COPY of the sketch's old name is offered the new one, in one
 * quiet prompt. A take counts as a copy when its title is:
 *   - the old name exactly,
 *   - the old name plus a file extension ("To Create.wav" — a received file), or
 *   - the old name with a thread version suffix ("To Create v2"), which keeps
 *     its suffix ("New name v2"), so a version thread renames in step.
 * Never touched: any take named something else, machine-named takes
 * (timestamps, "New Recording 7"), and takes already called the new name.
 * One direction only: renaming a take never renames the sketch.
 */
const VERSION_SUFFIX = /^(.*?)\s+v(\d+)$/i;

export function planSketchTakeRenames(
  clips: ClipVersion[],
  previousTitle: string,
  nextTitle: string
): LineageRenameTarget[] {
  const from = previousTitle.trim();
  const to = nextTitle.trim();
  if (!from || !to || from === to) return [];
  // The old sketch name may itself have carried an extension (a received
  // file); a take named either way is the same copy.
  const fromNames = new Set([from, titleFromFileName(from)]);

  const renames: LineageRenameTarget[] = [];
  for (const clip of clips) {
    if (isTitleAutoNamed(clip)) continue;
    const bare = titleFromFileName(clip.title);
    let target: string | null = null;
    if (fromNames.has(clip.title.trim()) || fromNames.has(bare)) {
      target = to;
    } else {
      const versioned = VERSION_SUFFIX.exec(bare);
      if (versioned && fromNames.has(versioned[1]!.trim())) target = `${to} v${versioned[2]}`;
    }
    if (target && target !== clip.title) renames.push({ clip, nextTitle: target });
  }
  return renames;
}

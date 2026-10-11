import type { Workspace } from "../types";

/** idea id → title, for matching a compilation by the songs inside it. */
export function buildIdeaTitleIndex(workspaces: readonly Workspace[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const workspace of workspaces) {
    for (const idea of workspace.ideas) index.set(idea.id, idea.title);
  }
  return index;
}

/** The hub's search is scoped to the active tab and looks INSIDE each
 *  compilation the way a collection's search looks inside its ideas: a
 *  playlist, chart book or setlist matches on its own title, its note, or the
 *  title of any song it holds (2026-10-11). */
export function matchesCompilationSearch(
  query: string,
  fields: { title: string; description?: string; ideaIds: readonly string[] },
  ideaTitles: ReadonlyMap<string, string>
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (fields.title.toLowerCase().includes(needle)) return true;
  if (fields.description && fields.description.toLowerCase().includes(needle)) return true;
  for (const ideaId of fields.ideaIds) {
    const title = ideaTitles.get(ideaId);
    if (title && title.toLowerCase().includes(needle)) return true;
  }
  return false;
}

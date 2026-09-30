import type { Workspace } from "../types";

/**
 * THE visibility choke point for workspace origin. Every surface that shows,
 * searches, or creates into workspaces decides what it sees through these
 * helpers — never by filtering `origin` inline.
 *
 * The rule: DISCOVERY and CREATION surfaces (workspace picker, browse, search,
 * Revisit, Activity, recents, library add-pickers, the recorder's targeting)
 * see PERSONAL workspaces only. RESOLUTION by id (players, setlist folders,
 * songbook readers, the Shelf resolving a set-aside) spans ALL workspaces, so
 * received content keeps working everywhere it's explicitly referenced.
 */

export function isReceivedWorkspace(workspace: Workspace): boolean {
  return workspace.origin === "received";
}

/** The user's own creative spaces — what discovery/creation surfaces see. */
export function personalWorkspaces(workspaces: Workspace[]): Workspace[] {
  return workspaces.filter((workspace) => !isReceivedWorkspace(workspace));
}

/** Received packages — what the Received page lists, newest first. */
export function receivedPackages(workspaces: Workspace[]): Workspace[] {
  return workspaces
    .filter(isReceivedWorkspace)
    .slice()
    .sort((a, b) => (b.received?.receivedAt ?? 0) - (a.received?.receivedAt ?? 0));
}

/** Received packages the recipient has not opened yet — the drawer's badge. */
export function unopenedReceivedCount(workspaces: Workspace[]): number {
  return workspaces.filter(
    (workspace) => isReceivedWorkspace(workspace) && workspace.received?.openedAt == null
  ).length;
}

/** How many received packages exist — a count, so a selector stays O(n) with no allocation. */
export function countReceivedPackages(workspaces: Workspace[]): number {
  let count = 0;
  for (const workspace of workspaces) if (isReceivedWorkspace(workspace)) count += 1;
  return count;
}

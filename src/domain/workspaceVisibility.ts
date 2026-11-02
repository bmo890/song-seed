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

/**
 * Where new work may land: the user's own workspaces that are not archived. An archived
 * workspace's audio is packed away in its archive, so anything saved or moved into it
 * would sit outside that archive and be lost on the next unarchive. Save and move
 * pickers use this; the workspace list itself still shows archived ones.
 */
export function writableWorkspaces(workspaces: Workspace[]): Workspace[] {
  return workspaces.filter((workspace) => !isReceivedWorkspace(workspace) && !workspace.isArchived);
}

/**
 * Read-only workspaces (founder decision B, 2026-11-02): a received parcel until the
 * person chooses Keep, and an archived workspace (its audio is packed away; anything
 * written into the stub is lost on unarchive). Content there plays, reads, sends and
 * can be kept; nothing edits, records into, or lands in it. The store refuses such
 * writes (see `updateIdeas`) and screens ask `useReadOnlyIdea` / `useReadOnlyWorkspace`.
 */
export function isReadOnlyWorkspace(workspace: Workspace | null | undefined): boolean {
  if (!workspace) return false;
  return isReceivedWorkspace(workspace) || !!workspace.isArchived;
}

/** Whether new work may land in, or edits may touch, the workspace with this id.
 *  A missing workspace is not writable either. */
export function isWritableWorkspaceId(workspaces: Workspace[], workspaceId: string | null | undefined): boolean {
  if (!workspaceId) return false;
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId);
  return !!workspace && !isReadOnlyWorkspace(workspace);
}

/** The first workspace new work may land in, or null. Fallbacks (after a delete, an
 *  archive, at hydration) use this, so a received parcel never becomes "home". */
export function firstWritableWorkspaceId(workspaces: Workspace[], excludeId?: string | null): string | null {
  return workspaces.find((workspace) => workspace.id !== excludeId && !isReadOnlyWorkspace(workspace))?.id ?? null;
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

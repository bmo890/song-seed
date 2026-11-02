import { useStore } from "../state/useStore";
import { findWorkspaceOfIdea } from "../state/librarySelectors";
import { isReadOnlyWorkspace } from "../domain/workspaceVisibility";

/**
 * Read-only (founder decision B, 2026-11-02): a received parcel until Keep, and an
 * archived workspace. Content there plays, reads, sends and can be kept; nothing
 * edits it, records into it, or lands in it. Screens ask these instead of testing
 * `origin` / `isArchived` themselves, and the store refuses the write anyway.
 *
 * `reason` says which: "received" (the way out is Keep) or "archived" (the way out
 * is Unarchive). Null when the item is editable.
 */
export type ReadOnlyReason = "received" | "archived" | null;

function reasonOf(workspace: { origin?: string; isArchived?: boolean } | null | undefined): ReadOnlyReason {
  if (!workspace || !isReadOnlyWorkspace(workspace as never)) return null;
  return workspace.origin === "received" ? "received" : "archived";
}

/** Why the idea can't be edited, or null. A primitive, so the subscriber re-renders
 *  only when the answer changes. */
export function useReadOnlyIdeaReason(ideaId: string | null | undefined): ReadOnlyReason {
  return useStore((state) => reasonOf(findWorkspaceOfIdea(state.workspaces, ideaId)));
}

export function useIsReadOnlyIdea(ideaId: string | null | undefined): boolean {
  return useReadOnlyIdeaReason(ideaId) !== null;
}

export function useReadOnlyWorkspaceReason(workspaceId: string | null | undefined): ReadOnlyReason {
  return useStore((state) =>
    workspaceId ? reasonOf(state.workspaces.find((workspace) => workspace.id === workspaceId)) : null
  );
}

/** The quiet line's key for a reason ("Keep to edit" / "Unarchive to edit"). */
export function readOnlyLabelKey(reason: Exclude<ReadOnlyReason, null>): "readOnly.keepToEdit" | "readOnly.unarchiveToEdit" {
  return reason === "received" ? "readOnly.keepToEdit" : "readOnly.unarchiveToEdit";
}

export function useIsReadOnlyWorkspace(workspaceId: string | null | undefined): boolean {
  return useReadOnlyWorkspaceReason(workspaceId) !== null;
}

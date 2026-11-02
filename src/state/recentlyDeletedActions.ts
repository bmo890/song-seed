import type { DeletedItem, Workspace } from "../types";
import { i18n } from "../i18n";
import {
    collectManagedAudioUrisFromWorkspaces,
    collectManagedClipAudioUris,
    emptyTrashExcept,
    hardDeleteManagedFiles,
    measureTrash,
    restoreFilesFromTrash,
    restoreReferencedFilesFromTrash,
    trashFilenameOf,
} from "../services/managedMedia";
import { resolveManagedUri, toRelativeManagedPath } from "../services/storagePaths";
import { persistLog } from "../services/persistLog";
import {
    deletedItemClips,
    isDeletedItemExpired,
    restoreDeletedItems,
    type RestoreOutcome,
} from "./recentlyDeleted";
import { flushPersistedSnapshot, useStore } from "./useStore";

/**
 * Recently deleted, wired to the store and the files (decision A, 2026-11-02).
 * Restore puts records back and moves their audio out of the trash; Delete
 * permanently, Empty and the 30-day purge drop records durably first, then
 * delete their files for good, never a file the library or another record uses.
 */

/** Every managed file a record holds: its clips' audio, and an archived workspace's package. */
export function deletedItemMediaUris(item: DeletedItem): string[] {
    const uris = new Set<string>();
    for (const clip of deletedItemClips(item)) {
        for (const uri of collectManagedClipAudioUris(clip)) uris.add(uri);
    }
    const archivePath = toRelativeManagedPath(item.workspace?.archiveState?.archiveUri);
    if (archivePath) uris.add(resolveManagedUri(archivePath));
    return Array.from(uris);
}

function libraryFilenames(workspaces: Workspace[], keptItems: DeletedItem[]): Set<string> {
    const names = new Set<string>();
    for (const uri of collectManagedAudioUrisFromWorkspaces(workspaces)) names.add(trashFilenameOf(uri));
    for (const workspace of workspaces) {
        if (workspace.archiveState?.archiveUri) names.add(trashFilenameOf(workspace.archiveState.archiveUri));
    }
    for (const item of keptItems) {
        for (const uri of deletedItemMediaUris(item)) names.add(trashFilenameOf(uri));
    }
    return names;
}

/** Whether a collection (or one inside it) holds any idea: an empty one a failed
 *  import made is nobody's deletion. */
export function collectionHoldsIdeas(collectionId: string): boolean {
    const workspace = useStore
        .getState()
        .workspaces.find((candidate) => candidate.collections.some((collection) => collection.id === collectionId));
    if (!workspace) return false;
    const scope = new Set([collectionId]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const collection of workspace.collections) {
            if (collection.parentCollectionId && scope.has(collection.parentCollectionId) && !scope.has(collection.id)) {
                scope.add(collection.id);
                grew = true;
            }
        }
    }
    return workspace.ideas.some((idea) => scope.has(idea.collectionId));
}

/** Put records back where they came from (ids intact). Resolves once their audio is
 *  back out of the trash. */
export async function restoreRecentlyDeleted(ids: Iterable<string>): Promise<RestoreOutcome[]> {
    const wanted = new Set(ids);
    const items = useStore.getState().recentlyDeleted.filter((item) => wanted.has(item.id));
    if (items.length === 0) return [];
    let outcomes: RestoreOutcome[] = [];
    useStore.setState((state) => {
        const result = restoreDeletedItems(state, wanted, {
            fallbackCollectionTitle: i18n.t("defaults.ideasCollection"),
        });
        outcomes = result.outcomes;
        return result.patch;
    });
    persistLog("deleted.restored", `${outcomes.length} record(s)`);
    await restoreFilesFromTrash(items.flatMap(deletedItemMediaUris));
    return outcomes;
}

async function forget(ids: Set<string>, reason: string): Promise<void> {
    const dropped = useStore.getState().recentlyDeleted.filter((item) => ids.has(item.id));
    if (dropped.length === 0) return;
    useStore.setState((state) => ({
        recentlyDeleted: state.recentlyDeleted.filter((item) => !ids.has(item.id)),
    }));
    // The record leaves durably before its files go: a crash in between leaves files
    // nobody points at (the trash purge takes them), never a record without its audio.
    await flushPersistedSnapshot();
    const state = useStore.getState();
    const inUse = libraryFilenames(state.workspaces, state.recentlyDeleted);
    const doomed = dropped.flatMap(deletedItemMediaUris).filter((uri) => !inUse.has(trashFilenameOf(uri)));
    await hardDeleteManagedFiles(doomed);
    persistLog("deleted.purged", `${dropped.length} record(s), ${doomed.length} file(s): ${reason}`);
}

/** Delete permanently: the records and their audio, for good. */
export function deleteRecentlyDeletedPermanently(ids: Iterable<string>): Promise<void> {
    return forget(new Set(ids), "delete permanently");
}

/** Empty: every record goes, and the whole media trash with them (people empty it to
 *  free space). A file the library still points at is first moved back, never lost. */
export async function emptyRecentlyDeleted(): Promise<void> {
    const ids = new Set(useStore.getState().recentlyDeleted.map((item) => item.id));
    await forget(ids, "empty");
    const state = useStore.getState();
    await restoreReferencedFilesFromTrash(state.workspaces);
    await emptyTrashExcept(libraryFilenames(state.workspaces, state.recentlyDeleted));
}

/** Launch: records past their 30 days go, with their files. */
export function purgeExpiredRecentlyDeleted(now: number = Date.now()): Promise<void> {
    const expired = useStore
        .getState()
        .recentlyDeleted.filter((item) => isDeletedItemExpired(item, now))
        .map((item) => item.id);
    return forget(new Set(expired), "30 days");
}

/** What each record's audio takes on the phone, and what Empty would free in all. */
export async function measureRecentlyDeleted(): Promise<{ byId: Map<string, number>; totalBytes: number }> {
    const { byFilename, totalBytes } = await measureTrash();
    const byId = new Map<string, number>();
    for (const item of useStore.getState().recentlyDeleted) {
        let bytes = 0;
        for (const uri of new Set(deletedItemMediaUris(item).map(trashFilenameOf))) bytes += byFilename.get(uri) ?? 0;
        byId.set(item.id, bytes);
    }
    return { byId, totalBytes };
}

import { useState } from "react";
import { returnHome } from "../../navigation";
import { useNavigation } from "@react-navigation/native";
import { SelectionActionSheet } from "./SelectionActionSheet";
import { QuickNameModal } from "../modals/QuickNameModal";
import { useStore } from "../../state/useStore";
import { toast } from "./toastStore";
import { haptic } from "../../design/haptics";
import { getPlayableClipForIdea } from "../../domain/clipPresentation";
import { useTranslation } from "react-i18next";

export type PlaylistChooserItem = { ideaId: string; clipId?: string | null };

type PlaylistChooserSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** What's being filed, in order — selected ideas, a sketch's takes, or the queue. */
  items: PlaylistChooserItem[];
  /** Named in the sheet title: "Add 4 to…" / the one title. */
  label: string;
};

/** Destination picker for "Playlist…": existing playlists plus a new one.
 *  Mirrors SongbookChooserSheet. Adding to an existing playlist confirms with
 *  a toast whose action jumps to it; a NEW playlist asks for its name first,
 *  then opens — you made a thing, so you land on it. The items are captured
 *  at open time so a selection that ends underneath never empties them. */
export function PlaylistChooserSheet({ visible, onClose, items, label }: PlaylistChooserSheetProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const playlists = useStore((s) => s.playlists);
  const [naming, setNaming] = useState<{ items: PlaylistChooserItem[]; draft: string } | null>(null);

  const openPlaylist = (playlistId: string) =>
    returnHome(navigation, {
      screen: "LibraryHome",
      params: { openCollectionKind: "playlist", openCollectionId: playlistId, openToken: Date.now() },
    });

  /** Adds the rows; returns how many landed (0 = nothing resolvable). */
  const addTo = (playlistId: string, toAdd: PlaylistChooserItem[]): number => {
    const store = useStore.getState();
    const rows = toAdd
      .map((item) => {
        const workspace = store.workspaces.find((ws) => ws.ideas.some((idea) => idea.id === item.ideaId));
        const idea = workspace?.ideas.find((candidate) => candidate.id === item.ideaId);
        if (!workspace || !idea) return null;
        return {
          kind: idea.kind === "project" && !item.clipId ? ("song" as const) : ("clip" as const),
          workspaceId: workspace.id,
          collectionId: idea.collectionId,
          ideaId: idea.id,
          clipId: item.clipId ?? (idea.kind === "project" ? null : getPlayableClipForIdea(idea)?.id ?? null),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (rows.length === 0) return 0;
    store.addItemsToPlaylist(playlistId, rows);
    return rows.length;
  };

  const addToExisting = (playlistId: string, title: string) => {
    if (addTo(playlistId, items) === 0) {
      // haptics vocabulary: `error` — a failure the user must hear about.
      haptic.error();
      toast(t("playlistChooser.nothingToAdd"), "alert-circle-outline");
      return;
    }
    // haptics vocabulary: `success` — a meaningful completion, paired with a toast.
    haptic.success();
    toast(t("playlistChooser.added", { title }), "musical-notes-outline", {
      action: { label: t("playlistChooser.openPlaylist"), onPress: () => openPlaylist(playlistId) },
    });
  };

  const createNamed = () => {
    if (!naming) return;
    const store = useStore.getState();
    const title = naming.draft.trim() || t("playlistChooser.defaultTitle", { number: store.playlists.length + 1 });
    const id = store.addPlaylist(title);
    const added = addTo(id, naming.items);
    setNaming(null);
    if (added === 0) {
      store.deletePlaylist(id);
      haptic.error();
      toast(t("playlistChooser.nothingToAdd"), "alert-circle-outline");
      return;
    }
    haptic.success();
    openPlaylist(id);
  };

  return (
    <>
      <SelectionActionSheet
        visible={visible}
        title={t("playlistChooser.addTo", { title: label })}
        onClose={onClose}
        actions={[
          ...playlists.map((playlist) => ({
            key: playlist.id,
            label: playlist.title,
            icon: "musical-notes-outline" as const,
            onPress: () => addToExisting(playlist.id, playlist.title),
          })),
          {
            key: "new-playlist",
            label: t("playlistChooser.newPlaylist"),
            icon: "add-circle-outline" as const,
            opens: true,
            onPress: () => {
              const number = useStore.getState().playlists.length + 1;
              // Snapshot the items: the sheet that opened us may end its selection now.
              setNaming({ items: [...items], draft: t("playlistChooser.defaultTitle", { number }) });
            },
          },
        ]}
      />
      <QuickNameModal
        visible={naming !== null}
        title={t("playlistChooser.nameTitle")}
        draftValue={naming?.draft ?? ""}
        placeholderValue={t("playlistChooser.defaultTitle", { number: playlists.length + 1 })}
        onChangeDraft={(draft) => setNaming((prev) => (prev ? { ...prev, draft } : prev))}
        helperText={t("playlistChooser.nameHint", { count: naming?.items.length ?? 0 })}
        saveLabel={t("playlistChooser.create")}
        onCancel={() => setNaming(null)}
        onSave={createNamed}
      />
    </>
  );
}

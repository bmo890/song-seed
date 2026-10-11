import { returnHome } from "../../navigation";
import { useNavigation } from "@react-navigation/native";
import { SelectionActionSheet } from "./SelectionActionSheet";
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

/** Destination picker for "Save to playlist": existing playlists plus a
 *  one-tap new one. Mirrors SongbookChooserSheet. Confirms with a toast whose
 *  action jumps straight to the playlist. */
export function PlaylistChooserSheet({ visible, onClose, items, label }: PlaylistChooserSheetProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const playlists = useStore((s) => s.playlists);

  const addTo = (playlistId: string, title: string) => {
    const store = useStore.getState();
    const rows = items
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
    if (rows.length === 0) return;
    store.addItemsToPlaylist(playlistId, rows);
    // haptics vocabulary: `success` — a meaningful completion, paired with a toast.
    haptic.success();
    toast(t("playlistChooser.added", { title }), "musical-notes-outline", {
      action: {
        label: t("playlistChooser.openPlaylist"),
        onPress: () => {
          returnHome(navigation, {
            screen: "LibraryHome",
            params: { openCollectionKind: "playlist", openCollectionId: playlistId, openToken: Date.now() },
          });
        },
      },
    });
  };

  return (
    <SelectionActionSheet
      visible={visible}
      title={t("playlistChooser.addTo", { title: label })}
      onClose={onClose}
      actions={[
        ...playlists.map((playlist) => ({
          key: playlist.id,
          label: playlist.title,
          icon: "musical-notes-outline" as const,
          onPress: () => addTo(playlist.id, playlist.title),
        })),
        {
          key: "new-playlist",
          label: t("playlistChooser.newPlaylist"),
          icon: "add-circle-outline" as const,
          onPress: () => {
            const store = useStore.getState();
            const title = t("playlistChooser.defaultTitle", { number: store.playlists.length + 1 });
            const id = store.addPlaylist(title);
            addTo(id, title);
          },
        },
      ]}
    />
  );
}

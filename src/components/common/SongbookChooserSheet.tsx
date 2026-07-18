import { useNavigation } from "@react-navigation/native";
import { SelectionActionSheet } from "./SelectionActionSheet";
import { useStore } from "../../state/useStore";
import { toast } from "./toastStore";
import { haptic } from "../../design/haptics";
import type { SongbookItemKind } from "../../types";

type SongbookChooserSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The chart(s) being filed — e.g. the chord chart, or one lyric version. */
  items: Array<{ kind: SongbookItemKind; versionId?: string }>;
  ideaId: string;
  ideaTitle: string;
};

/** Destination picker for "Add to songbook": existing books plus a one-tap new
 *  book. Confirms with a toast whose action jumps straight to the book. */
export function SongbookChooserSheet({
  visible,
  onClose,
  items,
  ideaId,
  ideaTitle,
}: SongbookChooserSheetProps) {
  const navigation = useNavigation<any>();
  const songbooks = useStore((s) => s.songbooks);

  const addTo = (songbookId: string, title: string) => {
    const store = useStore.getState();
    const workspaceId =
      store.workspaces.find((workspace) => workspace.ideas.some((idea) => idea.id === ideaId))?.id ??
      "";
    store.addItemsToSongbook(
      songbookId,
      items.map((item) => ({ kind: item.kind, workspaceId, ideaId, versionId: item.versionId }))
    );
    haptic.success();
    toast(`Added to "${title}"`, "book-outline", {
      action: {
        label: "Open book",
        onPress: () => {
          let current: any = navigation;
          while (current?.getParent?.()) current = current.getParent();
          current?.navigate?.("Home", {
            screen: "LibraryHome",
            params: {
              openCollectionKind: "songbook",
              openCollectionId: songbookId,
              openToken: Date.now(),
            },
          });
        },
      },
    });
  };

  return (
    <SelectionActionSheet
      visible={visible}
      title={`Add "${ideaTitle}" to…`}
      onClose={onClose}
      actions={[
        ...songbooks.map((book) => ({
          key: book.id,
          label: book.title,
          icon: "book-outline" as const,
          onPress: () => addTo(book.id, book.title),
        })),
        {
          key: "new-songbook",
          label: "New songbook…",
          icon: "add-circle-outline" as const,
          onPress: () => {
            const store = useStore.getState();
            const title = `Songbook ${store.songbooks.length + 1}`;
            const id = store.addSongbook(title);
            addTo(id, title);
          },
        },
      ]}
    />
  );
}

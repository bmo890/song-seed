import { ScrollView } from "react-native";
import { ListRow, ListRowMeta, ListRows } from "../../common/ListRow";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { usePersistedScrollView, type ScrollOffset } from "../../../hooks/usePersistedScrollView";
import type { Playlist } from "../../../types";
import { useTranslation } from "react-i18next";
import { i18n } from "../../../i18n/instance";
import { currentFormatLocale } from "../../../i18n/formatLocale";
import { EmptyState } from "../../common/EmptyState";
import { ProvenanceChip } from "../../common/ProvenanceChip";

function formatPlaylistUpdatedAt(timestamp: number) {
  const now = Date.now();
  const ageHours = Math.max(0, Math.floor((now - timestamp) / 3600000));
  if (ageHours < 1) return i18n.t("library.updatedNow");
  if (ageHours < 24) return i18n.t("library.updatedHours", { count: ageHours });
  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 7) return i18n.t("library.updatedDays", { count: ageDays });
  const locale = currentFormatLocale();
  return i18n.t("library.updatedDate", {
    date: new Date(timestamp).toLocaleDateString(locale, { month: "short", day: "numeric" }),
  });
}

export function PlaylistListView({
  playlists,
  onCreatePlaylist,
  onOpenPlaylist,
  scroll,
}: {
  playlists: Playlist[];
  onCreatePlaylist: () => void;
  onOpenPlaylist: (playlistId: string) => void;
  scroll?: ScrollOffset;
}) {
  const { t } = useTranslation();
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const { ref: scrollRef, ...scrollHandlers } = usePersistedScrollView(scroll);

  return (
    <ScrollView
      ref={scrollRef}
      {...scrollHandlers}
      style={styles.flexFill}
      contentContainerStyle={[styles.libraryScrollContent, { paddingBottom: 36 + playerDockHeight }]}
      showsVerticalScrollIndicator={false}
    >
      {/* One creation affordance per state: the hub's + key when there's a
          list, the empty state's own action when there isn't (2026-10-11). */}
      <ListRows>
        {playlists.map((playlist) => (
          <ListRow
            key={playlist.id}
            icon="musical-notes-outline"
            title={playlist.title}
            onPress={() => onOpenPlaylist(playlist.id)}
            meta={
              <>
                {playlist.received ? <ProvenanceChip received={playlist.received} /> : null}
                <ListRowMeta>{playlist.received ? "· " : ""}
                  {t("library.tracks", { count: playlist.items.length })} ·{" "}
                  {formatPlaylistUpdatedAt(playlist.updatedAt)}
                </ListRowMeta>
              </>
            }
          />
        ))}
      </ListRows>

      {playlists.length === 0 ? (
        <EmptyState
          icon="musical-notes-outline"
          title={t("library.playlistEmpty")}
          body={t("library.playlistEmptyBody")}
          actionLabel={t("library.newPlaylistShort")}
          onAction={onCreatePlaylist}
        />
      ) : null}
    </ScrollView>
  );
}

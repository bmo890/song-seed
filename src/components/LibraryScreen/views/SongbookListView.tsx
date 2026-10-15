import { ScrollView, View } from "react-native";
import { ListRow, ListRowMeta, ListRows } from "../../common/ListRow";
import { EmptyState } from "../../common/EmptyState";
import { ProvenanceChip } from "../../common/ProvenanceChip";
import { styles } from "../styles";
import { usePersistedScrollView, type ScrollOffset } from "../../../hooks/usePersistedScrollView";
import type { Songbook } from "../../../types";
import { useTranslation } from "react-i18next";

export function SongbookListView({
  songbooks,
  onCreate,
  onOpen,
  scroll,
}: {
  songbooks: Songbook[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  scroll?: ScrollOffset;
}) {
  const { t } = useTranslation();
  const { ref: scrollRef, ...scrollHandlers } = usePersistedScrollView(scroll);
  return (
    <ScrollView
      ref={scrollRef}
      {...scrollHandlers}
      style={styles.flexFill}
      contentContainerStyle={styles.libraryScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.listContent}>
        <ListRows>
          {songbooks.map((songbook) => (
            <ListRow
              key={songbook.id}
              icon="book-outline"
              title={songbook.title}
              onPress={() => onOpen(songbook.id)}
              meta={
                <>
                  {songbook.received ? <ProvenanceChip received={songbook.received} /> : null}
                  <ListRowMeta>{songbook.received ? "· " : ""}{t("library.charts", { count: songbook.items.length })}</ListRowMeta>
                </>
              }
            />
          ))}
        </ListRows>

        {songbooks.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title={t("library.noSongbooks")}
            body={t("library.songbookEmptyBody")}
            actionLabel={t("library.createSongbook")}
            onAction={onCreate}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

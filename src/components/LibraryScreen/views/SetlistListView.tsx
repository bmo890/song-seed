import { ScrollView, View } from "react-native";
import { ListRow, ListRowMeta, ListRows } from "../../common/ListRow";
import { EmptyState } from "../../common/EmptyState";
import { ProvenanceChip } from "../../common/ProvenanceChip";
import { styles } from "../styles";
import { usePersistedScrollView, type ScrollOffset } from "../../../hooks/usePersistedScrollView";
import type { Setlist } from "../../../types";
import { useTranslation } from "react-i18next";

export function SetlistListView({
  setlists,
  onCreate,
  onOpen,
  scroll,
}: {
  setlists: Setlist[];
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
          {setlists.map((setlist) => (
            <ListRow
              key={setlist.id}
              icon="albums-outline"
              title={setlist.title}
              onPress={() => onOpen(setlist.id)}
              meta={
                <>
                  {setlist.received ? <ProvenanceChip received={setlist.received} /> : null}
                  <ListRowMeta>{setlist.received ? "· " : ""}{t("library.songs", { count: setlist.entries.length })}</ListRowMeta>
                </>
              }
            />
          ))}
        </ListRows>

        {setlists.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title={t("library.noSetlists")}
            body={t("library.setlistEmptyBody")}
            actionLabel={t("library.createSetlist")}
            onAction={onCreate}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

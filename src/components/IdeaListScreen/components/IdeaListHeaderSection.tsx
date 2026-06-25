import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { ClipboardBanner } from "../../ClipboardBanner";
import { SongTargetPickerBanner } from "../../SongTargetPickerBanner";
import { ClipClipboard } from "../../../types";
import { useStore } from "../../../state/useStore";
import { SearchField } from "../../common/SearchField";
import { AppAlert } from "../../common/AppAlert";

type IdeaListHeaderSectionProps = {
  searchQuery: string;
  hasActivityRangeFilter: boolean;
  activityLabel?: string;
  collectionId: string;
  clipClipboard: ClipClipboard | null;
  duplicateWarningText: string;
  onSearchQueryChange: (value: string) => void;
  onClearActivityRange: () => void;
  onPasteClipboard: () => void;
  onCancelClipboard: () => void;
};

export function IdeaListHeaderSection({
  searchQuery,
  hasActivityRangeFilter,
  activityLabel,
  collectionId,
  clipClipboard,
  duplicateWarningText,
  onSearchQueryChange,
  onClearActivityRange,
  onPasteClipboard,
  onCancelClipboard,
}: IdeaListHeaderSectionProps) {
  const songTargetPicker = useStore((s) => s.songTargetPicker);
  const cancelSongTargetPicking = useStore((s) => s.cancelSongTargetPicking);

  return (
    <>
      {songTargetPicker ? (
        <SongTargetPickerBanner count={songTargetPicker.noteIds.length} onCancel={cancelSongTargetPicking} />
      ) : null}

      <View style={styles.ideasSearchUtilityRow}>
        <SearchField
          value={searchQuery}
          placeholder="Search titles, notes, lyrics..."
          containerStyle={{ flex: 1, minWidth: 0 }}
          onChangeText={onSearchQueryChange}
        />
      </View>

      {hasActivityRangeFilter ? (
        <View style={styles.activityRangeBanner}>
          <View style={styles.activityRangeBannerCopy}>
            <Ionicons name="calendar-outline" size={15} color="#475569" />
            <Text style={styles.activityRangeBannerText} numberOfLines={1}>
              {activityLabel ?? "Activity range"}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.activityRangeBannerClear, pressed ? styles.pressDown : null]}
            onPress={onClearActivityRange}
          >
            <Ionicons name="close" size={14} color="#64748b" />
          </Pressable>
        </View>
      ) : null}

      {clipClipboard ? (
        <ClipboardBanner
          count={clipClipboard.clipIds.length}
          mode={clipClipboard.mode}
          actionLabel="Paste to collection"
          onAction={() => {
            if (clipClipboard.sourceCollectionId === collectionId) {
              if (clipClipboard.mode === "move") {
                AppAlert.info(
                  "Cannot move here",
                  "You cannot move items into the same collection they are already in. To duplicate them, cancel and use Copy instead."
                );
                return;
              }
              AppAlert.confirm("Duplicate items?", duplicateWarningText, onPasteClipboard, { confirmLabel: "Duplicate" });
              return;
            }

            AppAlert.confirm(
              `${clipClipboard.mode === "move" ? "Move" : "Copy"} items here?`,
              `Are you sure you want to ${clipClipboard.mode} these items into this collection?`,
              onPasteClipboard,
              { confirmLabel: "Yes" }
            );
          }}
          onCancel={onCancelClipboard}
        />
      ) : null}
    </>
  );
}

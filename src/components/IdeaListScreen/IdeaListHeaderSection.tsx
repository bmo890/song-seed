import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { ClipboardBanner } from "../ClipboardBanner";
import { ClipClipboard, Collection } from "../../types";
import { PageIntro } from "../common/PageIntro";
import { SearchField } from "../common/SearchField";

type IdeaListHeaderSectionProps = {
  currentCollection: Collection;
  ideasHeaderMeta: string;
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
  currentCollection,
  ideasHeaderMeta,
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
  return (
    <>
      <PageIntro
        title={currentCollection.title}
        subtitle={ideasHeaderMeta}
        subtitleNumberOfLines={1}
      />

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
                Alert.alert(
                  "Cannot move here",
                  "You cannot move items into the same collection they are already in. To duplicate them, cancel and use Copy instead."
                );
                return;
              }
              Alert.alert("Duplicate items?", duplicateWarningText, [
                { text: "Cancel", style: "cancel" },
                { text: "Duplicate", onPress: onPasteClipboard },
              ]);
              return;
            }

            Alert.alert(
              `${clipClipboard.mode === "move" ? "Move" : "Copy"} items here?`,
              `Are you sure you want to ${clipClipboard.mode} these items into this collection?`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Yes", style: "default", onPress: onPasteClipboard },
              ]
            );
          }}
          onCancel={onCancelClipboard}
        />
      ) : null}
    </>
  );
}

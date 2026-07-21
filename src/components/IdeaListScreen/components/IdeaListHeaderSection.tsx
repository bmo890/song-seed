import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../../styles";
import { ClipboardBanner } from "../../ClipboardBanner";
import { SongTargetPickerBanner } from "../../SongTargetPickerBanner";
import { LibraryCollectorBanner } from "../../LibraryCollectorBanner";
import { ClipClipboard } from "../../../types";
import { useStore } from "../../../state/useStore";
import { SearchField } from "../../common/SearchField";
import { AppAlert } from "../../common/AppAlert";
import { useTranslation } from "react-i18next";

/** Walks up the navigator tree to reach a route registered on an ancestor
 *  (e.g. the drawer's LibraryHome from inside the workspace stack). */
function navigateToAncestorRoute(navigation: any, routeName: string, params?: Record<string, unknown>) {
  let current = navigation;
  while (current) {
    const routeNames = current.getState?.()?.routeNames;
    if (Array.isArray(routeNames) && routeNames.includes(routeName)) {
      current.navigate(routeName, params);
      return true;
    }
    current = current.getParent?.();
  }
  return false;
}

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
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const songTargetPicker = useStore((s) => s.songTargetPicker);
  const cancelSongTargetPicking = useStore((s) => s.cancelSongTargetPicking);
  const libraryCollector = useStore((s) => s.libraryCollector);

  return (
    <>
      {songTargetPicker ? (
        <SongTargetPickerBanner count={songTargetPicker.noteIds.length} onCancel={cancelSongTargetPicking} />
      ) : null}

      {libraryCollector ? (
        <LibraryCollectorBanner
          kind={libraryCollector.kind}
          targetTitle={libraryCollector.targetTitle}
          addedCount={libraryCollector.addedCount}
          onDone={() => {
            const { kind, targetId } = libraryCollector;
            useStore.getState().cancelLibraryCollecting();
            navigateToAncestorRoute(navigation, "LibraryHome", {
              openCollectionKind: kind,
              openCollectionId: targetId,
              openToken: Date.now(),
            });
          }}
          onCancel={() => useStore.getState().cancelLibraryCollecting()}
        />
      ) : null}

      <View style={styles.ideasSearchUtilityRow}>
        <SearchField
          testID="collection-search"
          value={searchQuery}
          placeholder={t("collection.searchPlaceholder")}
          containerStyle={{ flex: 1, minWidth: 0 }}
          onChangeText={onSearchQueryChange}
        />
      </View>

      {hasActivityRangeFilter ? (
        <View style={styles.activityRangeBanner}>
          <View style={styles.activityRangeBannerCopy}>
            <Ionicons name="calendar-outline" size={15} color="#475569" />
            <Text style={styles.activityRangeBannerText} numberOfLines={1}>
              {activityLabel ?? t("collection.activityRange")}
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
          actionLabel={t("collection.paste")}
          onAction={() => {
            if (clipClipboard.sourceCollectionId === collectionId) {
              if (clipClipboard.mode === "move") {
                AppAlert.info(
                  t("collection.cannotMove"),
                  t("collection.cannotMoveBody")
                );
                return;
              }
              AppAlert.confirm(t("collection.duplicateTitle"), duplicateWarningText, onPasteClipboard, { confirmLabel: t("collection.duplicate") });
              return;
            }

            AppAlert.confirm(
              t("collection.transferTitle", { action: t(clipClipboard.mode === "move" ? "collection.move" : "collection.copy") }),
              t("collection.transferBody", { action: t(clipClipboard.mode === "move" ? "collection.move" : "collection.copy") }),
              onPasteClipboard,
              { confirmLabel: t("collection.yes") }
            );
          }}
          onCancel={onCancelClipboard}
        />
      ) : null}
    </>
  );
}

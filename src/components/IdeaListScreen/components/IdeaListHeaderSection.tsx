import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../../styles";
import { ClipboardBanner } from "../../ClipboardBanner";
import { SongTargetPickerBanner } from "../../SongTargetPickerBanner";
import { LibraryCollectorBanner, useLibraryCollectorHandlers } from "../../LibraryCollectorBanner";
import { ClipClipboard } from "../../../types";
import { useStore } from "../../../state/useStore";
import { AppAlert } from "../../common/AppAlert";
import { useTranslation } from "react-i18next";

type IdeaListHeaderSectionProps = {
  hasActivityRangeFilter: boolean;
  activityLabel?: string;
  collectionId: string;
  clipClipboard: ClipClipboard | null;
  duplicateWarningText: string;
  onClearActivityRange: () => void;
  onPasteClipboard: () => void;
  onCancelClipboard: () => void;
};

export function IdeaListHeaderSection({
  hasActivityRangeFilter,
  activityLabel,
  collectionId,
  clipClipboard,
  duplicateWarningText,
  onClearActivityRange,
  onPasteClipboard,
  onCancelClipboard,
}: IdeaListHeaderSectionProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const songTargetPicker = useStore((s) => s.songTargetPicker);
  const cancelSongTargetPicking = useStore((s) => s.cancelSongTargetPicking);
  const libraryCollector = useStore((s) => s.libraryCollector);
  const collectorHandlers = useLibraryCollectorHandlers(navigation);

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
          onDone={collectorHandlers.onDone}
          onCancel={collectorHandlers.onCancel}
        />
      ) : null}

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

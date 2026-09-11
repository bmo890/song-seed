import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { ClipboardBanner } from "../../ClipboardBanner";
import { ClipClipboard } from "../../../types";
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

  // Picker modes (collector / song target) show no banner here: their eyebrow
  // rides above the title and their verbs live on the PickerFooter (2026-09-11).
  return (
    <>
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

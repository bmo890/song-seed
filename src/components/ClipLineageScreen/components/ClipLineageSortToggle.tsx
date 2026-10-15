import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { clipLineageStyles } from "../styles";

type SortDirection = "asc" | "desc";

type ClipLineageSortToggleProps = {
  direction: SortDirection;
  onToggle: () => void;
};

/** One tap flips the history's order; the key says the order in force, in
 *  the same words as every sort ("Newest first"). An ink key, not a pill. */
export function ClipLineageSortToggle({ direction, onToggle }: ClipLineageSortToggleProps) {
  const { t } = useTranslation();
  return (
    <View style={clipLineageStyles.sortToggleRow}>
      <InkKey
        glyph={
          <Ionicons name={direction === "asc" ? "arrow-up" : "arrow-down"} size={15} color={inkKeyColor("idle")} />
        }
        label={direction === "asc" ? t("filters.oldestFirst") : t("filters.newestFirst")}
        // haptics.ts: light → a small state flip.
        haptic="light"
        onPress={onToggle}
      />
    </View>
  );
}

import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { colors } from "../../../../design/tokens";
import { useTranslation } from "react-i18next";

type SongClipFilterTriggerProps = {
  active: boolean;
  open: boolean;
  onPress: () => void;
  onClear: () => void;
};

export function SongClipFilterTrigger({ active, open, onPress }: SongClipFilterTriggerProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ideasUtilityChip,
        styles.ideasUtilityChipIconOnly,
        open ? styles.ideasUtilityChipOpen : null,
        active ? { backgroundColor: "rgba(184,125,107,0.1)", borderColor: "rgba(184,125,107,0.45)" } : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("songDetail.filterByTag")}
    >
      <Ionicons
        name={active ? "funnel" : "funnel-outline"}
        size={15}
        color={active ? colors.primary : colors.textSecondary}
      />
    </Pressable>
  );
}

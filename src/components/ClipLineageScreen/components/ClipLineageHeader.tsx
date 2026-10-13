import { Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { clipLineageStyles, styles } from "../styles";

type ClipLineageHeaderProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
};

export function ClipLineageHeader({ title, subtitle, onBack }: ClipLineageHeaderProps) {
  return (
    <View style={clipLineageStyles.header}>
      <Press
        haptic="none"
        style={styles.backBtn}
        onPress={onBack}
      >
        <Ionicons name={dirIcon("chevron-back")} size={22} color="#0f172a" />
      </Press>
      <View style={clipLineageStyles.headerTitleWrap}>
        <Text style={clipLineageStyles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={clipLineageStyles.headerSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clipLineageStyles, styles } from "../styles";

type ClipLineageHeaderProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
};

export function ClipLineageHeader({ title, subtitle, onBack }: ClipLineageHeaderProps) {
  return (
    <View style={clipLineageStyles.header}>
      <Pressable
        style={({ pressed }) => [styles.backBtn, pressed ? styles.pressDown : null]}
        onPress={onBack}
      >
        <Ionicons name="chevron-back" size={22} color="#0f172a" />
      </Pressable>
      <View style={clipLineageStyles.headerTitleWrap}>
        <Text style={clipLineageStyles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={clipLineageStyles.headerSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

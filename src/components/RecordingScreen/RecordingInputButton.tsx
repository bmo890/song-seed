import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  disabled?: boolean;
  inputLabel?: string | null;
  onPress: () => void;
};

export function RecordingInputButton({ disabled = false, inputLabel = null, onPress }: Props) {
  return (
    <View style={localStyles.wrap}>
      <Pressable
        style={({ pressed }) => [
          localStyles.btn,
          disabled ? localStyles.btnDisabled : null,
          pressed ? localStyles.pressed : null,
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={inputLabel ? `Input device: ${inputLabel}` : "Input device"}
      >
        <Ionicons name="headset-outline" size={18} color="#524440" />
      </Pressable>
      <View style={localStyles.labelGroup}>
        <Text style={localStyles.label} numberOfLines={1}>
          Input
        </Text>
        <Text style={localStyles.sublabel} numberOfLines={1}>
          {inputLabel || "Default"}
        </Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  wrap: {
    width: 76,
    alignItems: "center",
    gap: 6,
  },
  labelGroup: {
    width: 76,
    alignItems: "center",
    gap: 1,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F1ED",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#84736f",
    textAlign: "center",
  },
  sublabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#a89994",
    textAlign: "center",
  },
});

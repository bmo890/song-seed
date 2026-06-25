import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { METRONOME_COUNT_IN_BAR_OPTIONS } from "../../metronome";

type Props = {
  countInBars: number;
  disabled?: boolean;
  onSelectCountInBars: (bars: number) => void;
};

function countInStateLabel(bars: number) {
  if (bars === 0) return "Off";
  return `${bars} bar${bars === 1 ? "" : "s"}`;
}

export function RecordingCountInButton({ countInBars, disabled = false, onSelectCountInBars }: Props) {
  function handlePress() {
    const currentIndex = METRONOME_COUNT_IN_BAR_OPTIONS.indexOf(
      countInBars as (typeof METRONOME_COUNT_IN_BAR_OPTIONS)[number]
    );
    const nextIndex = (Math.max(0, currentIndex) + 1) % METRONOME_COUNT_IN_BAR_OPTIONS.length;
    onSelectCountInBars(METRONOME_COUNT_IN_BAR_OPTIONS[nextIndex]);
  }

  const isOn = countInBars > 0;

  return (
    <View style={localStyles.wrap}>
      <View style={localStyles.circleSlot}>
        <Pressable
          style={({ pressed }) => [
            localStyles.btn,
            isOn ? localStyles.btnActive : null,
            disabled ? localStyles.btnDisabled : null,
            pressed ? localStyles.pressed : null,
          ]}
          onPress={handlePress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Count-in: ${countInStateLabel(countInBars)}. Tap to change.`}
        >
          <Ionicons name="stopwatch-outline" size={18} color={isOn ? "#FFFFFF" : "#524440"} />
        </Pressable>

        {isOn ? (
          <View style={localStyles.badge}>
            <Text style={localStyles.badgeText}>{countInBars}</Text>
          </View>
        ) : null}
      </View>
      <View style={localStyles.labelGroup}>
        <Text style={localStyles.label} numberOfLines={1}>
          Count-in
        </Text>
        <Text style={localStyles.sublabel} numberOfLines={1}>
          {countInStateLabel(countInBars)}
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
  circleSlot: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
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
  btnActive: {
    backgroundColor: "#B87D6B",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E4DF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B87D6B",
    fontVariant: ["tabular-nums"],
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
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
});

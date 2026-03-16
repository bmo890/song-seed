import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { type ComponentProps, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { ScreenHeader } from "../common/ScreenHeader";
import { colors, radii, shadows, spacing, text as textTokens } from "../../design/tokens";
import { useMetronome } from "../../hooks/useMetronome";
import {
  formatMetronomeLevel,
  formatMetronomeIntervalLabel,
  MAX_METRONOME_LEVEL,
  MAX_METRONOME_BPM,
  MIN_METRONOME_LEVEL,
  MIN_METRONOME_BPM,
  type MetronomeOutputKey,
} from "../../metronome";
import { styles } from "../../styles";

type IconName = ComponentProps<typeof Ionicons>["name"];

const OUTPUT_CONTROLS: { key: MetronomeOutputKey; label: string; icon: IconName }[] = [
  { key: "beep", label: "Beep", icon: "volume-high-outline" },
  { key: "visual", label: "Visual", icon: "pulse-outline" },
  { key: "haptic", label: "Haptic", icon: "phone-portrait-outline" },
];

const BPM_STEPS = [
  { label: "-5", delta: -5 },
  { label: "-1", delta: -1 },
  { label: "+1", delta: 1 },
  { label: "+5", delta: 5 },
];

export function MetronomeScreen() {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const {
    bpm,
    beatIntervalMs,
    isRunning,
    isPreparing,
    beepLevel,
    hapticLevel,
    outputs,
    pulseToken,
    tapCount,
    toggleRunning,
    setBpmValue,
    nudgeBpm,
    tapTempo,
    clearTapTempo,
    setBeepLevelValue,
    setHapticLevelValue,
    toggleOutput,
  } = useMetronome();

  const activeOutputCount = useMemo(
    () => Object.values(outputs).filter(Boolean).length,
    [outputs]
  );
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.18],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.26, 0],
  });

  useEffect(() => {
    if (!isRunning || !outputs.visual || pulseToken === 0) {
      return;
    }

    pulseAnim.stopAnimation();
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isRunning, outputs.visual, pulseAnim, pulseToken]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="" leftIcon="hamburger" />
      <AppBreadcrumbs
        hideIcons
        items={[
          { key: "home", label: "Home", level: "home" },
          { key: "metronome", label: "Metronome", level: "metronome", active: true },
        ]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={localStyles.pageContent}
      >
        <View style={localStyles.titleBlock}>
          <Text style={localStyles.title}>Metronome</Text>
          <Text style={localStyles.subtitle}>
            A steady pulse for practice now, reusable inside recording later.
          </Text>
        </View>

        <View style={localStyles.heroSurface}>
          <View style={localStyles.pulseStack}>
            <Animated.View
              pointerEvents="none"
              style={[
                localStyles.pulseHalo,
                {
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
            <View
              style={[
                localStyles.pulseCore,
                isRunning ? localStyles.pulseCoreActive : null,
                outputs.visual ? null : localStyles.pulseCoreMuted,
              ]}
            >
              <Ionicons
                name={isRunning ? "pause" : "play"}
                size={26}
                color={isRunning ? "#0f172a" : "#334155"}
              />
            </View>
          </View>

          <Text style={localStyles.bpmValue}>{bpm}</Text>
          <Text style={localStyles.bpmLabel}>beats per minute</Text>
          <Text style={localStyles.intervalLabel}>{formatMetronomeIntervalLabel(beatIntervalMs)}</Text>

          <Pressable
            style={({ pressed }) => [
              localStyles.primaryAction,
              isRunning ? localStyles.primaryActionStop : null,
              isPreparing ? localStyles.primaryActionDisabled : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={toggleRunning}
            disabled={isPreparing}
          >
            <Text
              style={[
                localStyles.primaryActionText,
                isRunning ? localStyles.primaryActionTextStop : null,
              ]}
            >
              {isPreparing ? "Preparing..." : isRunning ? "Stop" : "Start"}
            </Text>
          </Pressable>

          <Text style={localStyles.statusLabel}>
            {isPreparing
              ? "Rendering the click loop for this tempo."
              : isRunning
              ? activeOutputCount === 0
                ? "Running with no active cue outputs."
                : `${activeOutputCount} cue mode${activeOutputCount === 1 ? "" : "s"} active.`
              : "Ready"}
          </Text>
        </View>

        <View style={localStyles.section}>
          <View style={localStyles.sectionHeader}>
            <Text style={localStyles.sectionTitle}>Tempo</Text>
            <Text style={localStyles.sectionMeta}>
              {MIN_METRONOME_BPM} to {MAX_METRONOME_BPM} BPM
            </Text>
          </View>

          <View style={localStyles.bpmStepRow}>
            {BPM_STEPS.map((step) => (
              <Pressable
                key={step.label}
                style={({ pressed }) => [
                  localStyles.stepButton,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => nudgeBpm(step.delta)}
              >
                <Text style={localStyles.stepButtonText}>{step.label}</Text>
              </Pressable>
            ))}
          </View>

          <Slider
            minimumValue={MIN_METRONOME_BPM}
            maximumValue={MAX_METRONOME_BPM}
            step={1}
            minimumTrackTintColor="#7aa9da"
            maximumTrackTintColor="#d7dee8"
            thumbTintColor="#548ec9"
            value={bpm}
            onValueChange={setBpmValue}
          />

          <View style={localStyles.sliderLabels}>
            <Text style={localStyles.sliderLabel}>{MIN_METRONOME_BPM}</Text>
            <Text style={localStyles.sliderLabel}>{MAX_METRONOME_BPM}</Text>
          </View>
        </View>

        <View style={localStyles.section}>
          <View style={localStyles.sectionHeader}>
            <Text style={localStyles.sectionTitle}>Tap tempo</Text>
            <Text style={localStyles.sectionMeta}>
              {tapCount > 0 ? `${tapCount} tap${tapCount === 1 ? "" : "s"} captured` : "Tap 3 or more times"}
            </Text>
          </View>

          <View style={localStyles.tapRow}>
            <Pressable
              style={({ pressed }) => [
                localStyles.tapButton,
                pressed ? styles.pressDown : null,
              ]}
              onPress={tapTempo}
            >
              <Text style={localStyles.tapButtonText}>Tap tempo</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                localStyles.tapResetButton,
                pressed ? styles.pressDown : null,
              ]}
              onPress={clearTapTempo}
            >
              <Text style={localStyles.tapResetButtonText}>Reset</Text>
            </Pressable>
          </View>

          <Text style={localStyles.helperText}>
            BPM updates from the most recent consistent taps so it settles without bouncing around.
          </Text>
        </View>

        <View style={localStyles.section}>
          <View style={localStyles.sectionHeader}>
            <Text style={localStyles.sectionTitle}>Cue outputs</Text>
            <Text style={localStyles.sectionMeta}>Use them alone or combined</Text>
          </View>

          <View style={localStyles.outputRow}>
            {OUTPUT_CONTROLS.map((control) => {
              const active = outputs[control.key];

              return (
                <Pressable
                  key={control.key}
                  style={({ pressed }) => [
                    localStyles.outputToggle,
                    active ? localStyles.outputToggleActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => toggleOutput(control.key)}
                >
                  <Ionicons
                    name={control.icon}
                    size={18}
                    color={active ? "#2f6aa8" : colors.iconMuted}
                  />
                  <Text
                    style={[
                      localStyles.outputToggleText,
                      active ? localStyles.outputToggleTextActive : null,
                    ]}
                  >
                    {control.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={localStyles.helperText}>
            {activeOutputCount === 0
              ? "Enable at least one cue mode to hear, see, or feel the pulse."
              : "All cue modes can run together, and each toggle takes effect on the next beat."}
          </Text>

          <View style={localStyles.levelGroup}>
            <View style={localStyles.levelHeader}>
              <Text style={localStyles.levelTitle}>Beep level</Text>
              <Text style={localStyles.levelMeta}>{outputs.beep ? formatMetronomeLevel(beepLevel) : "Off"}</Text>
            </View>
            <Slider
              minimumValue={MIN_METRONOME_LEVEL}
              maximumValue={MAX_METRONOME_LEVEL}
              step={1}
              minimumTrackTintColor="#7aa9da"
              maximumTrackTintColor="#d7dee8"
              thumbTintColor="#548ec9"
              value={beepLevel}
              onValueChange={setBeepLevelValue}
            />
            <View style={localStyles.levelTrackLabels}>
              <Text style={localStyles.sliderLabel}>Softer</Text>
              <Text style={localStyles.sliderLabel}>Stronger</Text>
            </View>
          </View>

          <View style={localStyles.levelGroup}>
            <View style={localStyles.levelHeader}>
              <Text style={localStyles.levelTitle}>Haptic level</Text>
              <Text style={localStyles.levelMeta}>{outputs.haptic ? formatMetronomeLevel(hapticLevel) : "Off"}</Text>
            </View>
            <Slider
              minimumValue={MIN_METRONOME_LEVEL}
              maximumValue={MAX_METRONOME_LEVEL}
              step={1}
              minimumTrackTintColor="#7aa9da"
              maximumTrackTintColor="#d7dee8"
              thumbTintColor="#548ec9"
              value={hapticLevel}
              onValueChange={setHapticLevelValue}
            />
            <View style={localStyles.levelTrackLabels}>
              <Text style={localStyles.sliderLabel}>Softer</Text>
              <Text style={localStyles.sliderLabel}>Stronger</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  pageContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: spacing.xl,
  },
  titleBlock: {
    gap: spacing.xs,
  },
  title: textTokens.pageTitle,
  subtitle: {
    ...textTokens.supporting,
    maxWidth: 420,
  },
  heroSurface: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  pulseStack: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  pulseHalo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(84, 142, 201, 0.24)",
  },
  pulseCore: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e7edf4",
    borderWidth: 1,
    borderColor: "#d8e0ea",
  },
  pulseCoreActive: {
    backgroundColor: "#d7e8f8",
    borderColor: "#c3d7eb",
  },
  pulseCoreMuted: {
    backgroundColor: colors.surface,
  },
  bpmValue: {
    fontSize: 58,
    lineHeight: 62,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -1.5,
  },
  bpmLabel: {
    ...textTokens.caption,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  intervalLabel: {
    ...textTokens.supporting,
  },
  primaryAction: {
    marginTop: spacing.sm,
    minWidth: 140,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  primaryActionStop: {
    backgroundColor: "#dbe6f1",
  },
  primaryActionDisabled: {
    opacity: 0.6,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
  },
  primaryActionTextStop: {
    color: "#1e293b",
  },
  statusLabel: {
    ...textTokens.supporting,
  },
  section: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...textTokens.sectionTitle,
  },
  sectionMeta: {
    ...textTokens.caption,
  },
  bpmStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepButton: {
    minWidth: 62,
    minHeight: 42,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  stepButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sliderLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderLabel: {
    ...textTokens.caption,
  },
  tapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tapButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d9e6f5",
  },
  tapButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#244b78",
  },
  tapResetButton: {
    minWidth: 90,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  tapResetButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textStrong,
  },
  outputRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  outputToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  outputToggleActive: {
    backgroundColor: "#e8f1fb",
    borderColor: "#bfd3ea",
  },
  outputToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textStrong,
  },
  outputToggleTextActive: {
    color: "#244b78",
  },
  helperText: {
    ...textTokens.supporting,
    maxWidth: 480,
  },
  levelGroup: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  levelMeta: {
    ...textTokens.caption,
  },
  levelTrackLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -4,
  },
});

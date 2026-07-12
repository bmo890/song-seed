import { useRef, useState } from "react";
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../../design/tokens";
import { haptic } from "../../design/haptics";

/**
 * First-run (and replayable) intro. Three swipeable panes in Songstead's voice —
 * capture → grow → practice — over the paper background. Skippable from any pane;
 * the final pane's CTA dismisses. Rendered as a full-screen gate above the app so
 * the seeded workspace is already waiting behind it.
 */

type Pane = {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  body: string;
};

const PANES: Pane[] = [
  {
    icon: "mic-outline",
    eyebrow: "Capture",
    title: "Catch the spark",
    body: "Hum it, strum it, sing it — Songstead records the idea before it slips away.",
  },
  {
    icon: "leaf-outline",
    eyebrow: "Grow",
    title: "Tend every idea",
    body: "Takes, lyrics, chords, versions — each seed of a song lives in one place, ready when you return.",
  },
  {
    icon: "repeat-outline",
    eyebrow: "Practice",
    title: "Make it yours",
    body: "Loop a section, slow it down, shift the pitch, and play it back until the song is real.",
  },
];

export function WelcomeFlow({ onDone }: { onDone: () => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(Dimensions.get("window").width);
  const isLast = index === PANES.length - 1;

  const goTo = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const handleNext = () => {
    haptic.tap();
    if (isLast) {
      onDone();
      return;
    }
    goTo(index + 1);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== index) setIndex(next);
  };

  return (
    <SafeAreaView
      style={s.screen}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityViewIsModal
    >
      <View style={s.topBar}>
        <Pressable
          onPress={() => {
            haptic.tap();
            onDone();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip the intro"
        >
          <Text style={s.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={s.pager}
      >
        {PANES.map((pane) => (
          <View key={pane.title} style={[s.pane, { width }]}>
            <View style={s.iconRing}>
              <Ionicons name={pane.icon} size={40} color={colors.primary} />
            </View>
            <Text style={s.eyebrow}>{pane.eyebrow}</Text>
            <Text style={s.title}>{pane.title}</Text>
            <Text style={s.body}>{pane.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.footer}>
        <View style={s.dots}>
          {PANES.map((pane, i) => (
            <View key={pane.title} style={[s.dot, i === index ? s.dotActive : null]} />
          ))}
        </View>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [s.cta, pressed ? s.ctaPressed : null]}
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Start using Songstead" : "Next"}
        >
          <Text style={s.ctaText}>{isLast ? "Start" : "Next"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.page,
    zIndex: 100,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    minHeight: 32,
  },
  skip: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textSecondary,
  },
  pager: {
    flex: 1,
  },
  pane: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: spacing.md,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: colors.borderMuted,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.primary,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    lineHeight: 24,
    color: colors.textStrong,
    textAlign: "center",
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  cta: {
    minHeight: 52,
    borderRadius: radii.round,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
});

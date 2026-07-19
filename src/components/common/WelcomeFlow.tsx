import { useRef, useState } from "react";
import {
  ActivityIndicator,
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
import {
  runWelcomeImport,
  WELCOME_IMPORT_COLLECTION_TITLE,
  type WelcomeImportProgress,
} from "../../services/welcomeImport";

/**
 * First-run (and replayable) intro. Four swipeable panes in SongNook's voice —
 * capture → grow → practice → bring your recordings — over the paper background.
 * Skippable from any pane; the final pane's CTA dismisses. Rendered as a
 * full-screen gate above the app so the seeded workspace is already waiting
 * behind it. The import pane hands off to the real import pipeline and runs
 * detached: tapping Start mid-import never interrupts it (the global import
 * pill takes over the progress).
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
    body: "Hum it, strum it, sing it — SongNook records the idea before it slips away.",
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

/** The interactive "bring your recordings" pane — last pane of the intro. */
function ImportPane({ width }: { width: number }) {
  const [progress, setProgress] = useState<WelcomeImportProgress | null>(null);
  const [picking, setPicking] = useState(false);
  const busy = picking || progress?.phase === "importing";

  const handlePick = async () => {
    if (busy) return;
    haptic.tap();
    setPicking(true);
    try {
      const result = await runWelcomeImport(setProgress);
      if (result.outcome === "cancelled") {
        // Picker dismissed — keep whatever state was showing before (a prior
        // done-summary stays; a fresh pane stays idle).
        return;
      }
      if (result.outcome === "imported" && result.imported > 0) {
        haptic.success();
      }
    } finally {
      setPicking(false);
    }
  };

  const doneSummary =
    progress?.phase === "done"
      ? [
          progress.imported > 0
            ? `${progress.imported} recording${progress.imported === 1 ? "" : "s"} added`
            : null,
          progress.skippedDuplicates > 0
            ? `${progress.skippedDuplicates} already in your library`
            : null,
          progress.failed > 0 ? `${progress.failed} couldn’t be read` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <View style={[s.pane, { width }]}>
      <View style={s.iconRing}>
        <Ionicons name="albums-outline" size={40} color={colors.primary} />
      </View>
      <Text style={s.eyebrow}>Bring it with you</Text>
      <Text style={s.title}>Your recordings belong here</Text>
      <Text style={s.body}>
        Got a phone full of voice memos? Bring them in now — they’ll settle into an
        “{WELCOME_IMPORT_COLLECTION_TITLE}” collection, ready to grow.
      </Text>

      {progress?.phase === "done" ? (
        <View style={s.importDone}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          <Text style={s.importDoneText}>{doneSummary || "All set"}</Text>
        </View>
      ) : null}
      {progress?.phase === "done" && progress.imported > 0 ? (
        <Text style={s.importCaption}>
          Find them in “{WELCOME_IMPORT_COLLECTION_TITLE}” — waveforms fill in on their own.
        </Text>
      ) : null}
      {progress?.phase === "error" ? (
        <Text style={s.importErrorText}>
          That didn’t work — try again, or import anytime from the + button.
        </Text>
      ) : null}

      <Pressable
        onPress={handlePick}
        disabled={busy}
        style={({ pressed }) => [
          s.importButton,
          pressed && !busy ? s.importButtonPressed : null,
          busy ? s.importButtonBusy : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Choose audio files to import"
        testID="welcome-import-files"
      >
        {progress?.phase === "importing" ? (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={s.importButtonText}>
              Importing {Math.min(progress.current + 1, progress.total)} of {progress.total}…
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
            <Text style={s.importButtonText}>
              {progress?.phase === "done" ? "Import more files" : "Choose audio files"}
            </Text>
          </>
        )}
      </Pressable>

      <Text style={s.importCaption}>
        {progress?.phase === "importing"
          ? "You can tap Start — the import keeps going on its own."
          : "Or skip this — importing is always one tap away from the + button."}
      </Text>
    </View>
  );
}

export function WelcomeFlow({ onDone }: { onDone: () => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(Dimensions.get("window").width);
  // The three story panes plus the interactive import pane.
  const paneCount = PANES.length + 1;
  const isLast = index === paneCount - 1;

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
        <ImportPane width={width} />
      </ScrollView>

      <View style={s.footer}>
        <View style={s.dots}>
          {Array.from({ length: paneCount }, (_, i) => (
            <View key={i} style={[s.dot, i === index ? s.dotActive : null]} />
          ))}
        </View>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [s.cta, pressed ? s.ctaPressed : null]}
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Start using SongNook" : "Next"}
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
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.round,
    backgroundColor: "#FDF5F2",
    marginTop: spacing.md,
  },
  importButtonPressed: {
    opacity: 0.8,
  },
  importButtonBusy: {
    opacity: 0.9,
  },
  importButtonText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  importDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  importDoneText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  importErrorText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 300,
  },
  importCaption: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 300,
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

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
import { useTranslation } from "react-i18next";

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
    icon: "color-wand-outline",
    eyebrow: "Develop",
    title: "Shape every idea",
    body: "Takes, lyrics, chords, and versions stay together — ready whenever you return.",
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
  const { t } = useTranslation();
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
            ? t("welcome.recordingsAdded", { count: progress.imported })
            : null,
          progress.skippedDuplicates > 0
            ? t("welcome.alreadyInLibrary", { count: progress.skippedDuplicates })
            : null,
          progress.failed > 0 ? t("welcome.filesUnreadable", { count: progress.failed }) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <View style={[s.pane, { width }]}>
      <View style={s.iconRing}>
        <Ionicons name="albums-outline" size={40} color={colors.primary} />
      </View>
      <Text style={s.eyebrow}>{t("welcome.importEyebrow")}</Text>
      <Text style={s.title}>{t("welcome.importTitle")}</Text>
      <Text style={s.body}>
        {t("welcome.importBody", { collection: WELCOME_IMPORT_COLLECTION_TITLE })}
      </Text>

      {progress?.phase === "done" ? (
        <View style={s.importDone}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          <Text style={s.importDoneText}>{doneSummary || t("welcome.allSet")}</Text>
        </View>
      ) : null}
      {progress?.phase === "done" && progress.imported > 0 ? (
        <Text style={s.importCaption}>
          {t("welcome.importedCaption", { collection: WELCOME_IMPORT_COLLECTION_TITLE })}
        </Text>
      ) : null}
      {progress?.phase === "error" ? (
        <Text style={s.importErrorText}>
          {t("welcome.importError")}
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
        accessibilityLabel={t("welcome.chooseFilesA11y")}
        testID="welcome-import-files"
      >
        {progress?.phase === "importing" ? (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={s.importButtonText}>
              {t("welcome.importing", { current: Math.min(progress.current + 1, progress.total), total: progress.total })}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
            <Text style={s.importButtonText}>
              {t(progress?.phase === "done" ? "welcome.importMore" : "welcome.chooseFiles")}
            </Text>
          </>
        )}
      </Pressable>

      <Text style={s.importCaption}>
        {progress?.phase === "importing"
          ? t("welcome.importingHint")
          : t("welcome.skipImportHint")}
      </Text>
    </View>
  );
}

export function WelcomeFlow({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(Dimensions.get("window").width);
  // The three story panes plus the interactive import pane.
  const panes = [
    { ...PANES[0], eyebrow: t("welcome.captureEyebrow"), title: t("welcome.captureTitle"), body: t("welcome.captureBody") },
    { ...PANES[1], eyebrow: t("welcome.growEyebrow"), title: t("welcome.growTitle"), body: t("welcome.growBody") },
    { ...PANES[2], eyebrow: t("welcome.practiceEyebrow"), title: t("welcome.practiceTitle"), body: t("welcome.practiceBody") },
  ];
  const paneCount = panes.length + 1;
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
          accessibilityLabel={t("welcome.skipA11y")}
        >
          <Text style={s.skip}>{t("welcome.skip")}</Text>
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
        {panes.map((pane) => (
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
          accessibilityLabel={isLast ? t("welcome.startA11y") : t("welcome.next")}
        >
          <Text style={s.ctaText}>{isLast ? t("welcome.start") : t("welcome.next")}</Text>
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

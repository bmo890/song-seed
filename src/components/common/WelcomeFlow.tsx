import { useMemo, useState, type ReactNode } from "react";
import {
  I18nManager,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Spinner } from "./Spinner";
import ReAnimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { collapseIn, collapseOut } from "../../design/motion";
import { Button } from "./Button";
import { LanguageSelect } from "./LanguageSelect";
import {
  CoverScene,
  GemScene,
  OrganizeScene,
  PracticeScene,
  ShareScene,
  SketchesScene,
  WordsScene,
} from "../welcome/WelcomeScenes";
import {
  runWelcomeImport,
  welcomeImportCollectionTitle,
  type WelcomeImportProgress,
} from "../../services/welcomeImport";
import { useTranslation } from "react-i18next";

/**
 * First-run (and replayable) tour, rebuilt 2026-10-25 (founder: "more understandable",
 * and pictures that can serve as store material). Seven panes: the cover with the
 * app language (read from the phone, changeable here), then one pane per promise —
 * sketches and versions, writing, practice, sharing, never losing an idea, getting
 * organized — each a real slice of the app (welcome/WelcomeScenes.tsx) over one title
 * and one line. The last pane hands off to the real import pipeline, which runs
 * detached: tapping Start mid-import never interrupts it (the global import pill takes
 * over). Skippable from any pane.
 *
 * Pane changes are a fade + 6px settle (`collapseIn`/`collapseOut`) — the motion
 * vocabulary has no horizontal slides. A horizontal swipe still advances/retreats as a
 * GESTURE; only the resulting motion is a fade, which keeps the pager direction-correct
 * under RTL with no offset math.
 */

const PANE_COUNT = 7;
const FADE_HEIGHT = 40;
/** Eyebrow, a two-line title and a three-line body, plus the band's padding. */
const COPY_BAND_HEIGHT =
  spacing.xxl + 16 + spacing.sm + textTokens.cardTitle.lineHeight * 2 + spacing.sm + 23 * 3 + spacing.xxl * 2;

/** The scene runs on past its window and sinks into the paper. */
function SceneFade() {
  return (
    <View style={s.sceneFade} pointerEvents="none">
      <Svg width="100%" height={FADE_HEIGHT}>
        <Defs>
          <LinearGradient id="welcomeSceneFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.page} stopOpacity={0} />
            <Stop offset="0.85" stopColor={colors.page} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={FADE_HEIGHT} fill="url(#welcomeSceneFade)" />
      </Svg>
    </View>
  );
}

/** One promise: a real slice of the app above, its title and one line below. The
 *  scene is a picture — never a control. */
function FeaturePane({
  scene,
  eyebrow,
  title,
  body,
  fit = false,
  children,
}: {
  scene: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  /** A scene that must be seen whole (the practice controls) shrinks to its window
   *  on a short screen instead of sinking into the fade. Lists keep running on. */
  fit?: boolean;
  children?: ReactNode;
}) {
  const [windowHeight, setWindowHeight] = useState(0);
  const [sceneHeight, setSceneHeight] = useState(0);
  const room = windowHeight - FADE_HEIGHT - spacing.sm * 2;
  const scale = fit && room > 0 && sceneHeight > 0 ? Math.min(1, room / sceneHeight) : 1;
  return (
    <View style={s.pane}>
      <View
        style={s.sceneWindow}
        onLayout={(event) => setWindowHeight(event.nativeEvent.layout.height)}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {/* A non-scrolling ScrollView: the scene keeps its natural height (cards
            measure themselves) and the window clips what runs past it. */}
        <ScrollView
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.sceneInner}
        >
          <View
            onLayout={(event) => setSceneHeight(event.nativeEvent.layout.height)}
            style={scale < 1 ? [s.sceneFit, { transform: [{ scale }] }] : undefined}
          >
            {scene}
          </View>
        </ScrollView>
        <SceneFade />
      </View>
      <View style={s.copy}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.body}>{body}</Text>
        {children}
      </View>
    </View>
  );
}

/** The cover: the mark, the name, the promise, and the language (from the phone,
 *  changeable here; a change restarts the app into this same pane). */
function CoverPane() {
  const { t } = useTranslation();
  return (
    <View style={[s.pane, s.coverPane]}>
      <CoverScene />
      <Text style={s.coverName}>SongNook</Text>
      <Text style={s.coverTagline}>{t("welcome.tagline")}</Text>
      <View style={s.coverLanguage}>
        <LanguageSelect />
      </View>
    </View>
  );
}

/** "Get organized" + the voice-memo import. Import state lives in the parent so pane
 *  changes never lose a running import's summary. */
function ImportControls({
  progress,
  busy,
  onPick,
}: {
  progress: WelcomeImportProgress | null;
  busy: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();

  const doneSummary =
    progress?.phase === "done"
      ? [
          progress.imported > 0
            ? t("welcome.clipsAdded", { count: progress.imported })
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
    <>
      {progress?.phase === "done" ? (
        <View style={s.importDone}>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          <Text style={s.importDoneText}>{doneSummary || t("welcome.allSet")}</Text>
        </View>
      ) : null}
      {progress?.phase === "done" && progress.imported > 0 ? (
        <Text style={s.importCaption}>
          {t("welcome.importedCaption", { collection: welcomeImportCollectionTitle() })}
        </Text>
      ) : null}
      {progress?.phase === "error" ? (
        <Text style={s.importErrorText}>{t("welcome.importError")}</Text>
      ) : null}

      <Pressable
        onPress={onPick}
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
            <Spinner size="small" color={colors.textStrong} />
            <Text style={s.importButtonText}>
              {t("welcome.importing", {
                current: Math.min(progress.current + 1, progress.total),
                total: progress.total,
              })}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="folder-open-outline" size={18} color={colors.textStrong} />
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
    </>
  );
}

export function WelcomeFlow({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [importProgress, setImportProgress] = useState<WelcomeImportProgress | null>(null);
  const [picking, setPicking] = useState(false);
  const importBusy = picking || importProgress?.phase === "importing";
  const isLast = index === PANE_COUNT - 1;

  const handlePick = async () => {
    if (importBusy) return;
    haptic.tap();
    setPicking(true);
    try {
      const result = await runWelcomeImport(setImportProgress);
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

  const handleNext = () => {
    if (isLast) {
      onDone();
      return;
    }
    setIndex((i) => Math.min(i + 1, PANE_COUNT - 1));
  };

  // Swipe advances like Next / retreats like back. In RTL the reading axis
  // flips, so "forward" is a swipe toward the line start on either side.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        // Silent, like every navigation gesture — only pressed controls tick.
        onPanResponderRelease: (_evt, g) => {
          const forward = I18nManager.isRTL ? g.dx > 48 : g.dx < -48;
          const back = I18nManager.isRTL ? g.dx < -48 : g.dx > 48;
          if (forward && index < PANE_COUNT - 1) {
            setIndex(index + 1);
          } else if (back && index > 0) {
            setIndex(index - 1);
          }
        },
      }),
    [index]
  );

  return (
    <SafeAreaView style={s.screen} accessibilityViewIsModal>
      <View style={s.topBar}>
        <Button
          label={t("welcome.skip")}
          variant="quiet"
          accessibilityLabel={t("welcome.skipA11y")}
          onPress={onDone}
        />
      </View>

      <View style={s.paneArea} {...panResponder.panHandlers}>
        <ReAnimated.View key={index} entering={collapseIn} exiting={collapseOut} style={s.paneFill}>
          {index === 0 ? (
            <CoverPane />
          ) : index === 1 ? (
            <FeaturePane
              scene={<SketchesScene />}
              eyebrow={t("welcome.sketchesEyebrow")}
              title={t("welcome.sketchesTitle")}
              body={t("welcome.sketchesBody")}
            />
          ) : index === 2 ? (
            <FeaturePane
              scene={<WordsScene />}
              eyebrow={t("welcome.wordsEyebrow")}
              title={t("welcome.wordsTitle")}
              body={t("welcome.wordsBody")}
            />
          ) : index === 3 ? (
            <FeaturePane
              scene={<PracticeScene />}
              fit
              eyebrow={t("welcome.practiceEyebrow")}
              title={t("welcome.practiceTitle")}
              body={t("welcome.practiceBody")}
            />
          ) : index === 4 ? (
            <FeaturePane
              scene={<ShareScene />}
              eyebrow={t("welcome.shareEyebrow")}
              title={t("welcome.shareTitle")}
              body={t("welcome.shareBody")}
            />
          ) : index === 5 ? (
            <FeaturePane
              scene={<GemScene />}
              eyebrow={t("welcome.gemEyebrow")}
              title={t("welcome.gemTitle")}
              body={t("welcome.gemBody")}
            />
          ) : (
            <FeaturePane
              scene={<OrganizeScene />}
              eyebrow={t("welcome.organizeEyebrow2")}
              title={t("welcome.organizeTitle2")}
              body={t("welcome.organizeBody2")}
            >
              <ImportControls progress={importProgress} busy={importBusy} onPick={handlePick} />
            </FeaturePane>
          )}
        </ReAnimated.View>
      </View>

      <View style={s.footer}>
        {/* Dots are real page controls, not decoration — the accessible way back
            to an earlier pane now that the pager is gesture-driven. */}
        <View style={s.dots}>
          {Array.from({ length: PANE_COUNT }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => {
                if (i === index) return;
                haptic.tap();
                setIndex(i);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("welcome.paneA11y", { number: i + 1, total: PANE_COUNT })}
            >
              <View style={[s.dot, i === index ? s.dotActive : null]} />
            </Pressable>
          ))}
        </View>
        <Button
          label={isLast ? t("welcome.start") : index === 0 ? t("welcome.getStarted") : t("welcome.next")}
          variant="primary"
          style={s.cta}
          accessibilityLabel={isLast ? t("welcome.startA11y") : t("welcome.next")}
          onPress={handleNext}
        />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    minHeight: 32,
  },
  paneArea: {
    flex: 1,
  },
  paneFill: {
    ...StyleSheet.absoluteFillObject,
  },
  pane: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  coverPane: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  coverName: {
    ...textTokens.pageTitle,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  coverTagline: {
    ...textTokens.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textStrong,
    textAlign: "center",
  },
  coverLanguage: {
    marginTop: spacing.xl,
  },
  // The scene takes what the copy leaves; its foot sinks into the paper.
  sceneWindow: {
    flex: 1,
    overflow: "hidden",
  },
  sceneInner: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  // Shrinks from its top edge, so the scene keeps its place under the header.
  sceneFit: {
    transformOrigin: "top",
  },
  sceneFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE_HEIGHT,
  },
  // The copy sits in a fixed band, top-aligned, so the eyebrow lands at the same
  // height on every pane whether the title takes one line or two, and a clear
  // gap keeps it off the dots.
  copy: {
    alignItems: "center",
    gap: spacing.sm,
    minHeight: COPY_BAND_HEIGHT,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl * 2,
  },
  eyebrow: {
    ...textTokens.annotation,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.primaryDeep,
  },
  title: {
    ...textTokens.cardTitle,
    textAlign: "center",
  },
  body: {
    ...textTokens.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textStrong,
    textAlign: "center",
    maxWidth: 320,
  },
  // ── Footer & import controls: soft-key language, no stadium pills ───────────
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
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
    alignSelf: "stretch",
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    // Secondary tier: Start is the pane's one primary key.
    backgroundColor: colors.surfaceHigh,
    marginTop: spacing.sm,
  },
  importButtonPressed: {
    opacity: 0.8,
  },
  importButtonBusy: {
    opacity: 0.9,
  },
  importButtonText: {
    ...textTokens.caption,
    fontSize: 13.5,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textStrong,
    letterSpacing: 0.2,
  },
  importDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  importDoneText: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  importErrorText: {
    ...textTokens.supporting,
    textAlign: "center",
    maxWidth: 300,
  },
  importCaption: {
    ...textTokens.supporting,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 300,
  },
});

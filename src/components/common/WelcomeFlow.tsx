import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  I18nManager,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ReAnimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { collapseIn, collapseOut } from "../../design/motion";
import { dirIcon } from "../../design/directionalIcons";
import { Button } from "./Button";
import {
  runWelcomeImport,
  WELCOME_IMPORT_COLLECTION_TITLE,
  type WelcomeImportProgress,
} from "../../services/welcomeImport";
import { useTranslation } from "react-i18next";

/**
 * First-run (and replayable) intro. Five panes — capture, the workspace map,
 * clip→sketch, lyric versions, then the interactive audio import — over the
 * paper background. The wizard teaches the NOUNS only; verbs (versioning,
 * practice) are taught in place by help sheets. Skippable from any pane; the
 * final pane's CTA dismisses. Rendered as a full-screen gate above the app so
 * the seeded workspace is already waiting behind it. The import pane hands off
 * to the real import pipeline and runs detached: tapping Start mid-import
 * never interrupts it (the global import pill takes over the progress).
 *
 * Pane changes are a fade + 6px settle (`collapseIn`/`collapseOut`) — the
 * motion vocabulary has no horizontal slides. A horizontal swipe still
 * advances/retreats as a GESTURE; only the resulting motion is a fade, which
 * also keeps the pager direction-correct under RTL with no offset math.
 */

const PANE_COUNT = 5;

/** Shared frame: fixed-height motif slot above eyebrow/title/body so the type
 *  block sits at the same height on every pane (no layout hop between panes). */
function StoryPane({
  motif,
  eyebrow,
  title,
  body,
  children,
}: {
  motif: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View style={s.pane}>
      <View style={s.motifSlot}>{motif}</View>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      {children}
    </View>
  );
}

function IconRingMotif({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.iconRing}>
      <Ionicons name={icon} size={40} color={colors.primary} />
    </View>
  );
}

/** Pane 2 — the library map: a workspace holds collections; collections hold
 *  clips and sketches. Abstract tinted shapes, not screenshots. */
function OrganizeMotif() {
  const { t } = useTranslation();
  return (
    <View style={s.mapWorkspace}>
      <Text style={s.mapWorkspaceLabel}>{t("common.workspace")}</Text>
      <View style={s.mapCollection}>
        <Text style={s.mapCollectionLabel}>{t("welcome.mapCollection")}</Text>
        <View style={s.mapChipRow}>
          <View style={s.mapChip}>
            <Text style={s.mapChipText}>{t("screens.clip")}</Text>
          </View>
          <View style={s.mapChip}>
            <Text style={s.mapChipText}>{t("screens.clip")}</Text>
          </View>
          <View style={[s.mapChip, s.mapChipAccent]}>
            <Text style={[s.mapChipText, s.mapChipTextAccent]}>{t("brand.sketch")}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Pane 3 — a clip growing into a sketch with its four tabs. */
function GrowMotif() {
  const { t } = useTranslation();
  return (
    <View style={s.growRow}>
      <View style={s.mapChip}>
        <Text style={s.mapChipText}>{t("screens.clip")}</Text>
      </View>
      <Ionicons name={dirIcon("arrow-forward")} size={18} color={colors.primary} />
      <View style={s.growSketch}>
        <Text style={s.mapWorkspaceLabel}>{t("brand.sketch")}</Text>
        <View style={s.growTabs}>
          <Text style={[s.growTab, s.growTabActive]}>{t("screens.takes")}</Text>
          <Text style={s.growTab}>{t("screens.lyrics")}</Text>
          <Text style={s.growTab}>{t("screens.chart")}</Text>
          <Text style={s.growTab}>{t("screens.notes")}</Text>
        </View>
      </View>
    </View>
  );
}

/** Pane 4 — stacked lyric pages: the current version over an older one. */
function WriteMotif() {
  const { t } = useTranslation();
  return (
    <View style={s.versionStack}>
      <View style={[s.versionPage, s.versionPageCurrent]}>
        <Text style={s.versionTag}>{t("welcome.versionCurrent")}</Text>
        <View style={s.versionLine} />
        <View style={[s.versionLine, s.versionLineShort]} />
      </View>
      <View style={s.versionPage}>
        <Text style={[s.versionTag, s.versionTagMuted]}>{t("welcome.versionOld")}</Text>
        <View style={s.versionLine} />
      </View>
    </View>
  );
}

/** The interactive "bring your voice memos" pane — last pane of the intro.
 *  Import state lives in the parent so pane changes never lose a running
 *  import's summary. */
function ImportPane({
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
    <StoryPane
      motif={<IconRingMotif icon="albums-outline" />}
      eyebrow={t("welcome.importEyebrow")}
      title={t("welcome.importTitle")}
      body={t("welcome.importBody", { collection: WELCOME_IMPORT_COLLECTION_TITLE })}
    >
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
            <ActivityIndicator size="small" color={colors.primaryDeep} />
            <Text style={s.importButtonText}>
              {t("welcome.importing", {
                current: Math.min(progress.current + 1, progress.total),
                total: progress.total,
              })}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="folder-open-outline" size={18} color={colors.primaryDeep} />
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
    </StoryPane>
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
            <StoryPane
              motif={<IconRingMotif icon="mic-outline" />}
              eyebrow={t("welcome.captureEyebrow")}
              title={t("welcome.captureTitle")}
              body={t("welcome.captureBody")}
            />
          ) : index === 1 ? (
            <StoryPane
              motif={<OrganizeMotif />}
              eyebrow={t("welcome.organizeEyebrow")}
              title={t("welcome.organizeTitle")}
              body={t("welcome.organizeBody")}
            />
          ) : index === 2 ? (
            <StoryPane
              motif={<GrowMotif />}
              eyebrow={t("welcome.growEyebrow")}
              title={t("welcome.growTitle")}
              body={t("welcome.growBody")}
            />
          ) : index === 3 ? (
            <StoryPane
              motif={<WriteMotif />}
              eyebrow={t("welcome.writeEyebrow")}
              title={t("welcome.writeTitle")}
              body={t("welcome.writeBody")}
            />
          ) : (
            <ImportPane progress={importProgress} busy={importBusy} onPick={handlePick} />
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
          label={isLast ? t("welcome.start") : t("welcome.next")}
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: spacing.md,
  },
  motifSlot: {
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    alignSelf: "stretch",
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
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
    lineHeight: 24,
    color: colors.textStrong,
    textAlign: "center",
    maxWidth: 320,
  },
  // ── Motifs: abstract tinted shapes, all tokens ──────────────────────────────
  mapWorkspace: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    minWidth: 180,
  },
  mapWorkspaceLabel: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
  },
  mapCollection: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  mapCollectionLabel: {
    ...textTokens.caption,
    fontSize: 11,
  },
  mapChipRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  mapChip: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  mapChipAccent: {
    backgroundColor: colors.primarySurface,
  },
  mapChipText: {
    ...textTokens.caption,
    fontSize: 11,
    color: colors.textStrong,
  },
  mapChipTextAccent: {
    color: colors.primaryDeep,
  },
  growRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  growSketch: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  growTabs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  growTab: {
    ...textTokens.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  growTabActive: {
    color: colors.primaryDeep,
  },
  versionStack: {
    gap: spacing.xs,
    width: 168,
  },
  versionPage: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 5,
  },
  versionPageCurrent: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  versionTag: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
  },
  versionTagMuted: {
    color: colors.textMuted,
  },
  versionLine: {
    height: 4,
    borderRadius: radii.xs,
    backgroundColor: colors.borderMuted,
    alignSelf: "stretch",
  },
  versionLineShort: {
    alignSelf: "flex-start",
    width: "60%",
  },
  // ── Footer & import controls: soft-key language, no stadium pills ───────────
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
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
    backgroundColor: colors.primarySurface,
    marginTop: spacing.md,
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
    color: colors.primaryDeep,
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

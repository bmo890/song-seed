import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptic } from "../../design/haptics";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { SongIdea, type LyricsVersion } from "../../types";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { countLyricsVersionReferences, getLatestLyricsVersion, lyricsDocumentToText } from "../../domain/lyrics";
import { buildLyricsTextFromNote } from "../../domain/notepad";
import { Button } from "../common/Button";
import { AppAlert } from "../common/AppAlert";
import { NotePickerSheet } from "../modals/NotePickerSheet";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import { EmptyState } from "../common/EmptyState";
import { InkKey, inkKeyColor } from "../common/InkKey";
import { Press } from "../common/Press";
import type { SelectionAction } from "../common/SelectionDock";
import { colors, radii, shadows, spacing } from "../../design/tokens";
import type { Note } from "../../types";
import { useTranslation } from "react-i18next";
import { useLocale, UserText } from "../../i18n";
import type { TFunction } from "i18next";

type LyricsVersionsPanelProps = {
  projectIdea: SongIdea;
  /** Leads the toolbar row ("Write with the tape" on the sketch's tab). */
  toolbarLeading?: React.ReactNode;
};

/** Humanized card date — "Today · 1:14 AM", "Yesterday · …", "3 days ago", "Jun 28". */
function formatCardDate(ts: number, language: string, t: TFunction): string {
  const date = new Date(ts);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86400000);
  const locale = language === "he" ? "he-IL" : "en-US";
  const time = date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (days <= 0) return `${t("time.today")} · ${time}`;
  if (days === 1) return `${t("time.yesterday")} · ${time}`;
  if (days < 7) return t("lyrics.daysAgoShort", { count: days });
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

/** The current card shows this many lines before "Show all". */
const PREVIEW_LINES = 4;

/** A small ink key in the card's footer ("Show all ⌄", "2 older ⌄"). */
function FooterKey({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Press
      feel="glyph"
      // haptics.ts: light → small state flips (fold/unfold).
      haptic="light"
      style={panelStyles.footerKey}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      accessibilityRole="button"
    >
      <Text style={panelStyles.footerKeyText}>{label}</Text>
      <Ionicons name={icon} size={13} color={colors.textStrong} />
    </Press>
  );
}

export function LyricsVersionsPanel({ projectIdea, toolbarLeading }: LyricsVersionsPanelProps) {
  const { t } = useTranslation();
  const { language } = useLocale();
  const navigation = useNavigation<any>();
  const notes = useStore((s) => s.notes);
  const versions = projectIdea.kind === "project" ? projectIdea.lyrics?.versions ?? [] : [];
  const latestVersion = useMemo(() => getLatestLyricsVersion(projectIdea), [projectIdea]);
  const versionsNewestFirst = [...versions].reverse();
  const versionsKey = versions.map((version) => version.id).join("|");

  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [notePickerVisible, setNotePickerVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  // The older versions fold under the current page (Lyrics B, 2026-10-15).
  const [olderOpen, setOlderOpen] = useState(false);

  const versionHasChords = (version: LyricsVersion) =>
    version.document.lines.some((line) => line.chords.length > 0);

  useEffect(() => {
    // Everything starts collapsed — prune stale ids, never auto-expand.
    const visibleIds = new Set(versions.map((version) => version.id));
    setSelectedVersionIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [versions, versionsKey]);

  const selectionMode = selectedVersionIds.length > 0;
  const selectedVersions = versions.filter((version) => selectedVersionIds.includes(version.id));
  const selectedSingleVersion = selectedVersions.length === 1 ? selectedVersions[0] ?? null : null;

  function openVersion(versionId?: string, options?: { startInEdit?: boolean; forceNewVersion?: boolean; createDraft?: boolean }) {
    navigation.navigate("LyricsVersion", {
      ideaId: projectIdea.id,
      versionId,
      startInEdit: options?.startInEdit,
      forceNewVersion: options?.forceNewVersion,
      createDraft: options?.createDraft,
    });
  }

  function startSelection(versionId: string) {
    haptic.grab();
    setSelectedVersionIds([versionId]);
  }

  function toggleSelection(versionId: string) {
    setSelectedVersionIds((prev) =>
      prev.includes(versionId) ? prev.filter((id) => id !== versionId) : [...prev, versionId]
    );
  }

  function deleteSelectedVersions() {
    if (selectedVersionIds.length === 0) return;
    const includesLatest = !!latestVersion && selectedVersionIds.includes(latestVersion.id);
    const baseMessage =
      selectedVersionIds.length === 1
        ? includesLatest
          ? t("lyrics.deleteCurrent")
          : t("lyrics.deleteOne")
        : includesLatest
          ? t("lyrics.deleteSelectedCurrent")
          : t("lyrics.deleteSelected");

    // Deleting a referenced version severs takes/charts/setlists — say so, with
    // numbers, instead of letting the words swap silently later.
    const state = useStore.getState();
    const refs = countLyricsVersionReferences(
      projectIdea,
      selectedVersionIds,
      state.songbooks,
      state.setlists
    );
    const refParts = [
      refs.takes > 0 ? t("lyrics.refTakes", { count: refs.takes }) : null,
      refs.charts > 0 ? t("lyrics.refCharts", { count: refs.charts }) : null,
      refs.setlists > 0 ? t("lyrics.refSetlists", { count: refs.setlists }) : null,
    ].filter(Boolean);
    const message =
      refParts.length > 0
        ? `${baseMessage} ${t("lyrics.refFallback", { used: refParts.join(" · ") })}`
        : baseMessage;

    AppAlert.destructive(t("lyrics.deleteTitle"), message, () => {
      appActions.deleteProjectLyricsVersions(projectIdea.id, selectedVersionIds);
      setSelectedVersionIds([]);
    }, { confirmLabel: t("common.delete") });
  }

  function importFromLyricsPad(note: Note) {
    const text = buildLyricsTextFromNote(note);
    setNotePickerVisible(false);
    if (!text) {
      AppAlert.info(t("lyrics.emptyPage"), t("lyrics.emptyPageBody"));
      return;
    }
    appActions.saveProjectLyricsAsNewVersion(projectIdea.id, text);
    haptic.tap();
  }

  const createActions: SelectionAction[] = [
    {
      key: "from-current",
      label: t("lyrics.newFromCurrent"),
      icon: "copy-outline",
      onPress: () => openVersion(latestVersion?.id, { startInEdit: true, forceNewVersion: true }),
    },
    {
      key: "blank",
      label: t("lyrics.blankVersion"),
      icon: "document-outline",
      onPress: () => openVersion(undefined, { createDraft: true, startInEdit: true, forceNewVersion: true }),
    },
    {
      key: "from-lyrics-pad",
      label: t("lyrics.fromPad"),
      icon: "clipboard-outline",
      onPress: () => setNotePickerVisible(true),
      opens: true,
    },
  ];

  const selectionSheetActions: SelectionAction[] = [
    ...(selectedSingleVersion
      ? [
          {
            key: "new-draft",
            label: t("lyrics.newDraftFromThis"),
            icon: "copy-outline" as const,
            onPress: () =>
              openVersion(selectedSingleVersion.id, { startInEdit: true, forceNewVersion: true }),
          },
        ]
      : []),
    {
      key: "delete",
      label: t(selectedVersionIds.length === 1 ? "lyrics.deleteVersion" : "lyrics.deleteVersions"),
      icon: "trash-outline" as const,
      tone: "danger" as const,
      onPress: deleteSelectedVersions,
    },
  ];

  // ── Lyrics B (2026-10-15): the current page as a card, older versions
  // stacked beneath it like a take's. A tap opens the full page (lyrics,
  // the chords switch, Edit); the in-list expand is retired (founder,
  // 2026-10-15). Long-press selects, as before.
  const current = latestVersion ?? versionsNewestFirst[0] ?? null;
  const older = versionsNewestFirst.filter((version) => version.id !== current?.id);
  const numberOf = (version: LyricsVersion) => versions.findIndex((item) => item.id === version.id) + 1;
  const metaOf = (version: LyricsVersion) => {
    const lineCount = version.document.lines.filter((line) => line.text.trim().length > 0).length;
    return [
      t("clipLineage.versionTag", { number: numberOf(version) }),
      formatCardDate(version.updatedAt, language, t),
      t("lyrics.lineCount", { count: lineCount }),
      ...(versionHasChords(version) ? [t("lyrics.chords")] : []),
    ].join(" · ");
  };
  const pressVersion = (version: LyricsVersion) => {
    if (selectionMode) {
      toggleSelection(version.id);
      return;
    }
    openVersion(version.id);
  };
  const renderCurrent = (version: LyricsVersion) => {
    const text = lyricsDocumentToText(version.document);
    const isSelected = selectedVersionIds.includes(version.id);
    const stacked = older.length > 0 && !olderOpen;
    return (
      <View style={stacked ? styles.ideasListStack : null}>
        {stacked ? (
          <>
            <View pointerEvents="none" style={styles.ideasListStackBack} />
            <View pointerEvents="none" style={styles.ideasListStackMiddle} />
          </>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            panelStyles.card,
            isSelected ? panelStyles.cardSelected : null,
            pressed && !selectionMode ? styles.pressDown : null,
          ]}
          onPress={() => pressVersion(version)}
          onLongPress={() => startSelection(version.id)}
          delayLongPress={250}
          accessibilityRole="button"
          accessibilityLabel={t("lyrics.version", { number: numberOf(version) })}
        >
          <UserText align="content" value={text} style={panelStyles.lyric} numberOfLines={PREVIEW_LINES}>
            {text || t("lyrics.noLyricsVersion")}
          </UserText>
          <View style={panelStyles.footer}>
            <Text style={panelStyles.meta} numberOfLines={1}>
              {metaOf(version)}
            </Text>
            {older.length > 0 ? (
              <FooterKey
                label={t("clipLineage.olderShort", { count: older.length })}
                icon={olderOpen ? "chevron-up" : "chevron-down"}
                onPress={() => {
                  haptic.light();
                  setOlderOpen((open) => !open);
                }}
              />
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  };
  const renderOlder = (version: LyricsVersion, index: number) => {
    const text = lyricsDocumentToText(version.document);
    const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? t("lyrics.noLyricsVersion");
    const isSelected = selectedVersionIds.includes(version.id);
    return (
      <View
        key={version.id}
        style={[panelStyles.olderRow, index === older.length - 1 ? null : panelStyles.olderRowRule]}
      >
        <Pressable
          style={({ pressed }) => [
            panelStyles.olderRowTop,
            isSelected ? panelStyles.olderRowSelected : null,
            pressed && !selectionMode ? styles.pressDown : null,
          ]}
          onPress={() => pressVersion(version)}
          onLongPress={() => startSelection(version.id)}
          delayLongPress={250}
          accessibilityRole="button"
          accessibilityLabel={t("lyrics.version", { number: numberOf(version) })}
        >
          <View style={panelStyles.olderCopy}>
            <UserText align="content" value={firstLine} style={panelStyles.olderTitle} numberOfLines={1}>
              {firstLine}
            </UserText>
            <Text style={panelStyles.meta} numberOfLines={1}>
              {metaOf(version)}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.songDetailTabPanelWrap}>
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{t("lyrics.selected", { count: selectedVersionIds.length })}</Text>
          <View style={panelStyles.selectionActions}>
            {selectedSingleVersion ? (
              <Button
                variant="secondary"
                label={t("lyrics.edit")}
                onPress={() => openVersion(selectedSingleVersion.id, { startInEdit: true })}
              />
            ) : null}
            <Pressable
              style={({ pressed }) => [panelStyles.iconBtn, pressed ? styles.pressDown : null]}
              onPress={() => setMoreVisible(true)}
              hitSlop={6}
              accessibilityLabel={t("lyrics.moreActions")}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textStrong} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [panelStyles.doneBtn, pressed ? styles.pressDown : null]}
              onPress={() => setSelectedVersionIds([])}
              hitSlop={6}
            >
              <Text style={panelStyles.doneText}>{t("common.done")}</Text>
            </Pressable>
          </View>
        </View>
      ) : versions.length > 0 || toolbarLeading ? (
        // One toolbar row, the Takes tab's language: the tape door leads, the
        // forward action ("+ Version") sits on the trailing edge.
        <View style={panelStyles.controlRow}>
          {toolbarLeading ?? <View />}
          {versions.length > 0 ? (
            <InkKey
              glyph={<Ionicons name="add" size={17} color={inkKeyColor("idle")} />}
              label={t("clipLineage.versionKey")}
              accessibilityLabel={t("lyrics.newVersion")}
              onPress={() => setCreateVisible(true)}
            />
          ) : null}
        </View>
      ) : null}

      {versions.length === 0 ? (
        // The canon empty state: one tonal primary, one quiet ink link.
        <EmptyState
          icon="document-text-outline"
          title={t("lyrics.start")}
          body={t("lyrics.emptyStartBody")}
          actionLabel={t("lyrics.startWriting")}
          onAction={() => openVersion(undefined, { createDraft: true, startInEdit: true, forceNewVersion: true })}
          linkLabel={t("lyrics.fromPad")}
          onLink={() => setNotePickerVisible(true)}
        />
      ) : current ? (
        <>
          {renderCurrent(current)}
          {olderOpen ? <View style={panelStyles.olderList}>{older.map(renderOlder)}</View> : null}
        </>
      ) : null}

      <NotePickerSheet
        visible={notePickerVisible}
        notes={notes}
        onClose={() => setNotePickerVisible(false)}
        onSelect={importFromLyricsPad}
      />

      <SelectionActionSheet
        visible={moreVisible}
        title={t("lyrics.versionActions")}
        actions={selectionSheetActions}
        onClose={() => setMoreVisible(false)}
      />

      <SelectionActionSheet
        visible={createVisible}
        title={t("lyrics.newVersion")}
        actions={createActions}
        onClose={() => setCreateVisible(false)}
      />
    </View>
  );
}

const panelStyles = StyleSheet.create({
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  doneText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.onPrimary,
  },
  // The toolbar row: the tape door leads, "+ Version" trails.
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 46,
  },
  // The current page: a card for your work (IdeaCard recipe: white, r12,
  // whisper shadow). The border is reserved so selecting never resizes it.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 10,
    ...shadows.card,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  lyric: {
    fontFamily: "Lora_500Medium",
    fontSize: 16,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: spacing.md,
    minHeight: 26,
  },
  meta: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  footerKey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  footerKeyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textStrong,
  },
  // Older versions: rows on paper under the card, hairlines between.
  olderList: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  olderRow: {
    paddingVertical: 2,
  },
  olderRowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  olderRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radii.lg,
  },
  olderRowSelected: {
    backgroundColor: colors.primarySurface,
  },
  olderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  olderTitle: {
    fontFamily: "Lora_500Medium",
    fontSize: 15,
    color: colors.textStrong,
  },
});

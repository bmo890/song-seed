import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { SongIdea, type LyricsVersion } from "../../types";
import { ChordChart } from "../LyricsVersionScreen/components/chords/ChordChart";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { buildLyricsTextFromNote } from "../../notepad";
import { Button } from "../common/Button";
import { AppAlert } from "../common/AppAlert";
import { NotePickerSheet } from "../modals/NotePickerSheet";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import { LyricsChordsToggle } from "../common/LyricsChordsToggle";
import type { SelectionAction } from "../common/SelectionDock";
import { colors, radii, spacing } from "../../design/tokens";
import type { Note } from "../../types";

type LyricsVersionsPanelProps = {
  projectIdea: SongIdea;
};

/** Humanized card date — "Today · 1:14 AM", "Yesterday · …", "3 days ago", "Jun 28". */
function formatCardDate(ts: number): string {
  const date = new Date(ts);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86400000);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days <= 0) return `Today · ${time}`;
  if (days === 1) return `Yesterday · ${time}`;
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LyricsVersionsPanel({ projectIdea }: LyricsVersionsPanelProps) {
  const navigation = useNavigation<any>();
  const notes = useStore((s) => s.notes);
  const versions = projectIdea.kind === "project" ? projectIdea.lyrics?.versions ?? [] : [];
  const latestVersion = useMemo(() => getLatestLyricsVersion(projectIdea), [projectIdea]);
  const versionsNewestFirst = [...versions].reverse();
  const versionsKey = versions.map((version) => version.id).join("|");

  const [expandedVersionIds, setExpandedVersionIds] = useState<string[]>([]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [notePickerVisible, setNotePickerVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  // Chord view is per-version (per card), not global — each card remembers whether
  // it's showing lyrics or chords.
  const [chordVersionIds, setChordVersionIds] = useState<string[]>([]);

  const versionHasChords = (version: LyricsVersion) =>
    version.document.lines.some((line) => line.chords.length > 0);

  useEffect(() => {
    setExpandedVersionIds((prev) => {
      const visibleIds = new Set(versions.map((version) => version.id));
      const next = prev.filter((id) => visibleIds.has(id));
      if (latestVersion?.id && !next.includes(latestVersion.id)) {
        return [latestVersion.id, ...next];
      }
      return next;
    });
    setSelectedVersionIds((prev) => prev.filter((id) => versions.some((version) => version.id === id)));
  }, [latestVersion?.id, versions, versionsKey]);

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

  function toggleExpanded(versionId: string) {
    setExpandedVersionIds((prev) =>
      prev.includes(versionId) ? prev.filter((id) => id !== versionId) : [...prev, versionId]
    );
  }

  function startSelection(versionId: string) {
    void Haptics.selectionAsync();
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
    const message =
      selectedVersionIds.length === 1
        ? includesLatest
          ? "Delete the current lyrics version? The next newest version will become current."
          : "Delete this lyrics version?"
        : includesLatest
          ? "Delete the selected lyrics versions? The next newest remaining version will become current."
          : "Delete the selected lyrics versions?";

    AppAlert.destructive("Delete lyrics versions?", message, () => {
      appActions.deleteProjectLyricsVersions(projectIdea.id, selectedVersionIds);
      setSelectedVersionIds([]);
    }, { confirmLabel: "Delete" });
  }

  function importFromLyricsPad(note: Note) {
    const text = buildLyricsTextFromNote(note);
    setNotePickerVisible(false);
    if (!text) {
      AppAlert.info("Empty page", "That Lyrics Pad page has no text to import.");
      return;
    }
    appActions.saveProjectLyricsAsNewVersion(projectIdea.id, text);
    void Haptics.selectionAsync();
  }

  const createActions: SelectionAction[] = [
    {
      key: "from-current",
      label: "New version from current",
      icon: "git-branch-outline",
      onPress: () => openVersion(latestVersion?.id, { startInEdit: true, forceNewVersion: true }),
    },
    {
      key: "blank",
      label: "Blank version",
      icon: "document-outline",
      onPress: () => openVersion(undefined, { createDraft: true, startInEdit: true, forceNewVersion: true }),
    },
    {
      key: "from-lyrics-pad",
      label: "From Lyrics Pad",
      icon: "clipboard-outline",
      onPress: () => setNotePickerVisible(true),
    },
  ];

  const selectionSheetActions: SelectionAction[] = [
    ...(selectedSingleVersion
      ? [
          {
            key: "new-draft",
            label: "New draft from this",
            icon: "git-branch-outline" as const,
            onPress: () =>
              openVersion(selectedSingleVersion.id, { startInEdit: true, forceNewVersion: true }),
          },
        ]
      : []),
    {
      key: "delete",
      label: selectedVersionIds.length === 1 ? "Delete version" : "Delete versions",
      icon: "trash-outline" as const,
      tone: "danger" as const,
      onPress: deleteSelectedVersions,
    },
  ];

  return (
    <View style={styles.songDetailTabPanelWrap}>
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selectedVersionIds.length} selected</Text>
          <View style={panelStyles.selectionActions}>
            {selectedSingleVersion ? (
              <Button
                variant="secondary"
                label="Edit"
                onPress={() => openVersion(selectedSingleVersion.id, { startInEdit: true })}
              />
            ) : null}
            <Pressable
              style={({ pressed }) => [panelStyles.iconBtn, pressed ? styles.pressDown : null]}
              onPress={() => setMoreVisible(true)}
              hitSlop={6}
              accessibilityLabel="More actions"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textStrong} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [panelStyles.doneBtn, pressed ? styles.pressDown : null]}
              onPress={() => setSelectedVersionIds([])}
              hitSlop={6}
            >
              <Text style={panelStyles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : versions.length > 0 ? (
        <View style={panelStyles.controlRow}>
          <Text style={panelStyles.sectionLabel}>{`Versions · ${versions.length}`}</Text>
          <Pressable
            style={({ pressed }) => [panelStyles.addBtn, pressed ? styles.pressDown : null]}
            onPress={() => setCreateVisible(true)}
            hitSlop={6}
            accessibilityLabel="New version"
          >
            <Ionicons name="add" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
      ) : null}

      {versions.length === 0 ? (
        <View style={[styles.card, styles.songDetailTabPanelCard]}>
          <Text style={styles.pageTitleCompact}>Start Lyrics</Text>
          <Text style={styles.cardMeta}>
            This song has no saved lyric pages yet. Start the first draft and save it when you are ready.
          </Text>
          <View style={styles.rowButtons}>
            <Button
              label="Start Writing"
              onPress={() => openVersion(undefined, { createDraft: true, startInEdit: true, forceNewVersion: true })}
            />
            <Button
              variant="secondary"
              label="From Lyrics Pad"
              onPress={() => setNotePickerVisible(true)}
            />
          </View>
        </View>
      ) : (
        versionsNewestFirst.map((version) => {
          const isLatest = latestVersion?.id === version.id;
          const isExpanded = expandedVersionIds.includes(version.id);
          const isSelected = selectedVersionIds.includes(version.id);
          const versionNumber = versions.findIndex((item) => item.id === version.id) + 1;
          const previewText = lyricsDocumentToText(version.document);
          const lineCount = version.document.lines.filter((line) => line.text.trim().length > 0).length;
          const hasChords = versionHasChords(version);

          return (
            <View
              key={version.id}
              style={[
                styles.card,
                styles.songDetailTabPanelCard,
                isLatest ? panelStyles.cardCurrent : null,
                isSelected ? styles.listCardSelected : null,
              ]}
            >
              <Pressable
                style={({ pressed }) => (pressed && !selectionMode ? styles.pressDown : null)}
                onLongPress={() => startSelection(version.id)}
                delayLongPress={250}
                onPress={() => {
                  if (selectionMode) {
                    toggleSelection(version.id);
                    return;
                  }
                  openVersion(version.id);
                }}
              >
                <View style={panelStyles.cardTop}>
                  <View style={[panelStyles.vnum, isLatest ? panelStyles.vnumCur : null]}>
                    <Text style={[panelStyles.vnumText, isLatest ? panelStyles.vnumTextCur : null]}>
                      {versionNumber}
                    </Text>
                  </View>
                  <View style={panelStyles.cardBody}>
                    <View style={panelStyles.titleRow}>
                      <Text style={panelStyles.title} numberOfLines={1}>{`Version ${versionNumber}`}</Text>
                      {isLatest ? <Text style={panelStyles.currentChip}>CURRENT</Text> : null}
                      <Pressable
                        style={({ pressed }) => [panelStyles.chev, pressed ? styles.pressDown : null]}
                        hitSlop={6}
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleExpanded(version.id);
                        }}
                        accessibilityLabel={isExpanded ? "Collapse" : "Expand"}
                      >
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={15} color="#84736f" />
                      </Pressable>
                    </View>

                    <View style={panelStyles.metaRow}>
                      <Text style={panelStyles.meta}>{formatCardDate(version.updatedAt)}</Text>
                      <Text style={panelStyles.metaDot}>·</Text>
                      <Text style={panelStyles.meta}>{`${lineCount} ${lineCount === 1 ? "line" : "lines"}`}</Text>
                      {hasChords ? (
                        <>
                          <Text style={panelStyles.metaDot}>·</Text>
                          <View style={panelStyles.chordMeta}>
                            <Ionicons name="musical-notes" size={12} color={colors.primary} />
                            <Text style={panelStyles.chordMetaText}>chords</Text>
                          </View>
                        </>
                      ) : null}
                    </View>

                    {!isExpanded ? (
                      <Text style={panelStyles.preview} numberOfLines={2}>
                        {previewText || "No lyrics in this version."}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={panelStyles.expanded}>
                  {hasChords ? (
                    <View style={panelStyles.cardViewToggle}>
                      <LyricsChordsToggle
                        value={chordVersionIds.includes(version.id) ? "chords" : "lyrics"}
                        onChange={(next) =>
                          setChordVersionIds((prev) =>
                            next === "chords"
                              ? [...new Set([...prev, version.id])]
                              : prev.filter((id) => id !== version.id)
                          )
                        }
                      />
                    </View>
                  ) : null}
                  {chordVersionIds.includes(version.id) && hasChords ? (
                    <ChordChart lines={version.document.lines} editable={false} />
                  ) : (
                    <Text style={styles.lyricsPreviewText}>{previewText || "No lyrics in this version."}</Text>
                  )}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <NotePickerSheet
        visible={notePickerVisible}
        notes={notes}
        onClose={() => setNotePickerVisible(false)}
        onSelect={importFromLyricsPad}
      />

      <SelectionActionSheet
        visible={moreVisible}
        title="Lyrics version actions"
        actions={selectionSheetActions}
        onClose={() => setMoreVisible(false)}
      />

      <SelectionActionSheet
        visible={createVisible}
        title="New version"
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
  cardViewToggle: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  // Section header: a quiet "Versions · N" label that anchors the accented (+),
  // which opens the New version sheet (new from current, blank, or Lyrics Pad).
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Version card ────────────────────────────────────────────────────────────
  cardCurrent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  vnum: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#F2ECE4",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  vnumCur: {
    backgroundColor: "#F2E4DF",
  },
  vnumText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: "#6b5b54",
    fontVariant: ["tabular-nums"],
  },
  vnumTextCur: {
    color: "#824f3f",
  },
  cardBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: "#1C1C19",
  },
  currentChip: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.6,
    color: "#824f3f",
    backgroundColor: "#F2E4DF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.round,
    overflow: "hidden",
  },
  chev: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    backgroundColor: "#F4EEE7",
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: "#a89994",
    fontVariant: ["tabular-nums"],
  },
  metaDot: {
    fontSize: 12,
    color: "#d8cabf",
  },
  chordMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  chordMetaText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.primary,
  },
  preview: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "#9a8a82",
    marginTop: 10,
  },
  expanded: {
    marginTop: 12,
  },
});

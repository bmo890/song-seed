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
import { formatDate } from "../../utils";
import { Button } from "../common/Button";
import { AppAlert } from "../common/AppAlert";
import { NotePickerSheet } from "../modals/NotePickerSheet";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import type { SelectionAction } from "../common/SelectionDock";
import { colors, radii } from "../../design/tokens";
import type { Note } from "../../types";

type LyricsVersionsPanelProps = {
  projectIdea: SongIdea;
};

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
  const [showChords, setShowChords] = useState(false);

  const versionHasChords = (version: LyricsVersion) =>
    version.document.lines.some((line) => line.chords.length > 0);
  const anyVersionHasChords = useMemo(
    () => versions.some(versionHasChords),
    [versions]
  );

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
        <View style={styles.rowButtons}>
          <Button
            label="New Draft"
            onPress={() => openVersion(latestVersion?.id, { startInEdit: true, forceNewVersion: true })}
          />
          <Button
            variant="secondary"
            label="From Lyrics Pad"
            onPress={() => setNotePickerVisible(true)}
          />
        </View>
      ) : null}

      {!selectionMode && anyVersionHasChords ? (
        <Pressable
          onPress={() => setShowChords((prev) => !prev)}
          style={({ pressed }) => [
            panelStyles.chordToggle,
            showChords ? panelStyles.chordToggleActive : null,
            pressed ? styles.pressDown : null,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: showChords }}
        >
          <Ionicons
            name="musical-notes-outline"
            size={14}
            color={showChords ? colors.primary : colors.textSecondary}
          />
          <Text style={[panelStyles.chordToggleText, showChords ? panelStyles.chordToggleTextActive : null]}>
            {showChords ? "Hide chords" : "Show chords"}
          </Text>
        </Pressable>
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

          return (
            <View
              key={version.id}
              style={[
                styles.card,
                styles.lyricsTimelineCard,
                styles.songDetailTabPanelCard,
                isSelected ? styles.listCardSelected : null,
              ]}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.lyricsTimelineCardPressable,
                  pressed && !selectionMode ? styles.pressDown : null,
                ]}
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
                <View style={styles.lyricsVersionHeader}>
                  <View style={styles.lyricsVersionHeaderRow}>
                    <Text style={styles.cardTitle}>{`Version ${versionNumber}`}</Text>
                    {isLatest ? (
                      <Text style={[styles.badge, styles.badgeCurrent]}>CURRENT</Text>
                    ) : (
                      <View style={styles.lyricsVersionBadgePlaceholder} />
                    )}
                  </View>
                  <View style={styles.lyricsVersionHeaderRow}>
                    <Text style={styles.cardMeta}>{formatDate(version.updatedAt)}</Text>
                    <Pressable
                      style={styles.lyricsVersionToggleBtn}
                      hitSlop={6}
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleExpanded(version.id);
                      }}
                    >
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#84736f" />
                    </Pressable>
                  </View>
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.lyricsPreviewWrap}>
                  {showChords && versionHasChords(version) ? (
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
  chordToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
  },
  chordToggleActive: {
    backgroundColor: colors.surfaceHigh,
  },
  chordToggleText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  chordToggleTextActive: {
    color: colors.primary,
  },
});

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { SongIdea } from "../../types";
import { appActions } from "../../state/actions";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { formatDate } from "../../utils";
import { Button } from "../common/Button";

type LyricsVersionsPanelProps = {
  projectIdea: SongIdea;
};

export function LyricsVersionsPanel({ projectIdea }: LyricsVersionsPanelProps) {
  const navigation = useNavigation<any>();
  const versions = projectIdea.kind === "project" ? projectIdea.lyrics?.versions ?? [] : [];
  const latestVersion = useMemo(() => getLatestLyricsVersion(projectIdea), [projectIdea]);
  const versionsNewestFirst = [...versions].reverse();
  const versionsKey = versions.map((version) => version.id).join("|");

  const [expandedVersionIds, setExpandedVersionIds] = useState<string[]>([]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);

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

    Alert.alert("Delete lyrics versions?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          appActions.deleteProjectLyricsVersions(projectIdea.id, selectedVersionIds);
          setSelectedVersionIds([]);
        },
      },
    ]);
  }

  return (
    <View style={styles.songDetailTabPanelWrap}>
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selectedVersionIds.length} selected</Text>
          <View style={styles.rowButtons}>
            {selectedSingleVersion ? (
              <>
                <Button
                  variant="secondary"
                  label="New Draft"
                  onPress={() => openVersion(selectedSingleVersion.id, { startInEdit: true, forceNewVersion: true })}
                />
                <Button
                  variant="secondary"
                  label="Edit"
                  onPress={() => openVersion(selectedSingleVersion.id, { startInEdit: true })}
                />
              </>
            ) : null}
            <Button variant="secondary" label="Delete" onPress={deleteSelectedVersions} />
            <Button variant="secondary" label="Done" onPress={() => setSelectedVersionIds([])} />
          </View>
        </View>
      ) : versions.length > 0 ? (
        <View style={styles.rowButtons}>
          <Button
            label="New Draft"
            onPress={() => openVersion(latestVersion?.id, { startInEdit: true, forceNewVersion: true })}
          />
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
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#4b5563" />
                    </Pressable>
                  </View>
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.lyricsPreviewWrap}>
                  <Text style={styles.lyricsPreviewText}>{previewText || "No lyrics in this version."}</Text>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

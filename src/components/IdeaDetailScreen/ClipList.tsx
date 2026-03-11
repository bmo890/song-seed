import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "../../styles";
import { Button } from "../common/Button";
import { MiniProgress } from "../MiniProgress";
import { TitleInput } from "../common/TitleInput";
import { WaveformMiniPreview } from "../common/WaveformMiniPreview";
import { ActionButtons } from "./ActionButtons";
import { ClipActionsSheet } from "../modals/ClipActionsSheet";
import { useStore } from "../../state/useStore";
import { ClipVersion } from "../../types";
import {
  buildClipLineages,
  buildTimelineEntries,
  type SongTimelineSortDirection,
  type SongTimelineSortMetric,
  type TimelineClipEntry,
} from "../../clipGraph";
import { fmtDuration, formatDate } from "../../utils";
import { useInlinePlayer } from "../../hooks/useInlinePlayer";
import type { SongClipTagFilter } from "./songClipControls";

type ClipListProps = {
  isEditMode: boolean;
  footerSpacerHeight?: number;
  viewMode: "timeline" | "evolution";
  setViewMode: (mode: "timeline" | "evolution") => void;
  timelineSortMetric: SongTimelineSortMetric;
  setTimelineSortMetric: (metric: SongTimelineSortMetric) => void;
  timelineSortDirection: SongTimelineSortDirection;
  setTimelineSortDirection: (direction: SongTimelineSortDirection) => void;
  timelineMainTakesOnly: boolean;
  setTimelineMainTakesOnly: (value: boolean) => void;
  clipTagFilter: SongClipTagFilter;
  setClipTagFilter: (filter: SongClipTagFilter) => void;
  summaryContent?: ReactNode;
  onIdeasStickyChange?: (isSticky: boolean) => void;
  isParentPicking: boolean;
  parentPickSourceClipIds: string[];
  parentPickInvalidTargetIds: string[];
  onStartSetParent: (clipIds: string[]) => void;
  onMakeRoot: (clipIds: string[]) => void;
  onPickParentTarget: (clipId: string) => void;
};

type EvolutionClipEntry = {
  kind: "evolution";
  clip: ClipVersion;
  lineageRootId: string;
  position: "latest" | "older";
  compactPreview: boolean;
  indented: boolean;
  continuesThreadBelow: boolean;
};

type RenderClipEntry = TimelineClipEntry | EvolutionClipEntry;

type ClipListRow =
  | { kind: "summary-section" }
  | { kind: "primary-section" }
  | { kind: "ideas-header" }
  | { kind: "day-divider"; label: string; dayStartTs: number }
  | { kind: "empty" }
  | { kind: "evolution-more"; lineageRootId: string; hiddenCount: number }
  | { kind: "clip"; entry: RenderClipEntry };

function dayStartTs(ts: number) {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getDateDividerLabel(ts: number) {
  const todayStart = dayStartTs(Date.now());
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const targetStart = dayStartTs(ts);

  if (targetStart === todayStart) return "Today";
  if (targetStart === yesterdayStart) return "Yesterday";

  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildEvolutionRows(
  clips: ClipVersion[],
  expandedBranchIds: Record<string, boolean>
): ClipListRow[] {
  const rows: ClipListRow[] = [];

  buildClipLineages(clips)
    .slice()
    .sort((a, b) => {
      if (a.latestClip.createdAt !== b.latestClip.createdAt) {
        return b.latestClip.createdAt - a.latestClip.createdAt;
      }
      return b.latestClip.id.localeCompare(a.latestClip.id);
    })
    .forEach((lineage) => {
      const newestClip = lineage.latestClip;
      const olderClips = lineage.clipsNewestToOldest.filter((clip) => clip.id !== newestClip.id);

      rows.push({
        kind: "clip",
        entry: {
          kind: "evolution",
          clip: newestClip,
          lineageRootId: lineage.root.id,
          position: "latest",
          compactPreview: false,
          indented: false,
          continuesThreadBelow: false,
        },
      });

      if (olderClips.length > 0) {
        rows.push({
          kind: "evolution-more",
          lineageRootId: lineage.root.id,
          hiddenCount: olderClips.length,
        });

        if (expandedBranchIds[lineage.root.id]) {
          olderClips.forEach((clip, index) => {
            rows.push({
              kind: "clip",
              entry: {
                kind: "evolution",
                clip,
                lineageRootId: lineage.root.id,
                position: "older",
                compactPreview: true,
                indented: true,
                continuesThreadBelow: index < olderClips.length - 1,
              },
            });
          });
        }
      }
    });

  return rows;
}

export function ClipList({
  isEditMode,
  footerSpacerHeight = 28,
  viewMode,
  setViewMode,
  timelineSortMetric,
  setTimelineSortMetric,
  timelineSortDirection,
  setTimelineSortDirection,
  timelineMainTakesOnly,
  setTimelineMainTakesOnly,
  clipTagFilter,
  setClipTagFilter,
  summaryContent,
  onIdeasStickyChange,
  isParentPicking,
  parentPickSourceClipIds,
  parentPickInvalidTargetIds,
  onStartSetParent,
  onMakeRoot,
  onPickParentTarget,
}: ClipListProps) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const inlinePlayer = useInlinePlayer();

  const [expandedBranchIds, setExpandedBranchIds] = useState<Record<string, boolean>>({});
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingClipDraft, setEditingClipDraft] = useState("");
  const [editingClipNotesDraft, setEditingClipNotesDraft] = useState("");
  const [actionsClipId, setActionsClipId] = useState<string | null>(null);

  const highlightMapRef = useRef<Record<string, Animated.Value>>({});
  const animatingHighlightIdsRef = useRef<Set<string>>(new Set());
  const didBlurCleanupRef = useRef(false);

  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const movingClipId = useStore((s) => s.movingClipId);
  const pendingPrimaryClipId = useStore((s) => s.pendingPrimaryClipId);
  const recentlyAddedItemIds = useStore((s) => s.recentlyAddedItemIds);
  const clearRecentlyAdded = useStore((s) => s.clearRecentlyAdded);
  const parentPickSourceIdSet = useMemo(
    () => new Set(parentPickSourceClipIds),
    [parentPickSourceClipIds]
  );
  const parentPickInvalidTargetIdSet = useMemo(
    () => new Set(parentPickInvalidTargetIds),
    [parentPickInvalidTargetIds]
  );

  const selectedIdea = useStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
    return ws?.ideas.find((i) => i.id === s.selectedIdeaId);
  });

  const displayPrimaryId = useMemo(
    () =>
      pendingPrimaryClipId ?? selectedIdea?.clips.find((item) => item.isPrimary)?.id ?? null,
    [pendingPrimaryClipId, selectedIdea?.clips]
  );

  const primaryClip = useMemo(
    () =>
      selectedIdea?.kind === "project" && displayPrimaryId
        ? selectedIdea.clips.find((clip) => clip.id === displayPrimaryId) ?? null
        : null,
    [displayPrimaryId, selectedIdea]
  );

  const ideaClips = useMemo(
    () =>
      selectedIdea
        ? selectedIdea.clips.filter((clip) => clip.id !== primaryClip?.id)
        : [],
    [primaryClip?.id, selectedIdea]
  );

  const filteredIdeaClips = useMemo(() => {
    if (clipTagFilter === "all") return ideaClips;

    return ideaClips.filter((clip) => {
      const tags = Array.isArray((clip as ClipVersion & { tags?: string[] }).tags)
        ? ((clip as ClipVersion & { tags?: string[] }).tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)
        : [];

      if (clipTagFilter === "untagged") {
        return tags.length === 0;
      }

      return tags.includes(clipTagFilter);
    });
  }, [clipTagFilter, ideaClips]);

  const clipRows = useMemo<ClipListRow[]>(() => {
    if (!selectedIdea) return [];
    if (viewMode === "evolution") {
      return buildEvolutionRows(filteredIdeaClips, expandedBranchIds);
    }
    return buildTimelineEntries(filteredIdeaClips, {
      metric: timelineSortMetric,
      direction: timelineSortDirection,
      mainTakesOnly: timelineMainTakesOnly,
    }).map((entry) => ({ kind: "clip" as const, entry }));
  }, [
    expandedBranchIds,
    filteredIdeaClips,
    selectedIdea,
    timelineMainTakesOnly,
    timelineSortDirection,
    timelineSortMetric,
    viewMode,
  ]);

  const visibleClipEntries = useMemo(
    () => clipRows.filter((row): row is { kind: "clip"; entry: RenderClipEntry } => row.kind === "clip"),
    [clipRows]
  );

  const visibleClipIdsKey = visibleClipEntries.map((row) => row.entry.clip.id).join("|");

  useEffect(() => {
    const visibleIds = new Set(visibleClipEntries.map((row) => row.entry.clip.id));
    const idsToAnimate = recentlyAddedItemIds.filter(
      (id) => visibleIds.has(id) && !animatingHighlightIdsRef.current.has(id)
    );

    idsToAnimate.forEach((id) => {
      animatingHighlightIdsRef.current.add(id);
      const animatedValue = new Animated.Value(0);
      highlightMapRef.current[id] = animatedValue;

      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.9,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]).start(() => {
        delete highlightMapRef.current[id];
        animatingHighlightIdsRef.current.delete(id);
        clearRecentlyAdded([id]);
      });
    });
  }, [clearRecentlyAdded, recentlyAddedItemIds, visibleClipEntries, visibleClipIdsKey]);

  useEffect(() => {
    if (isFocused) {
      didBlurCleanupRef.current = false;
      return;
    }
    if (didBlurCleanupRef.current) return;
    didBlurCleanupRef.current = true;
    void inlinePlayer.resetInlinePlayer();
  }, [inlinePlayer, isFocused]);

  useEffect(() => {
    if (isParentPicking && viewMode !== "evolution") {
      setViewMode("evolution");
    }
  }, [isParentPicking, setViewMode, viewMode]);

  useEffect(() => {
    if (!isParentPicking) return;
    setActionsClipId(null);
    setEditingClipId(null);
  }, [isParentPicking]);

  if (!selectedIdea) return null;
  const songIdea = selectedIdea;
  const isDraftProject = !!songIdea.isDraft;
  const actionsClip = actionsClipId
    ? songIdea.clips.find((clip) => clip.id === actionsClipId) ?? null
    : null;

  function beginEditingClip(clip: ClipVersion) {
    setEditingClipId(clip.id);
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
  }

  function saveEditingClip(clipId: string) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== songIdea.id
          ? idea
          : {
              ...idea,
              clips: idea.clips.map((clip) =>
                clip.id === clipId
                  ? {
                      ...clip,
                      title: editingClipDraft.trim() || "Untitled Clip",
                      notes: editingClipNotesDraft.trim(),
                    }
                  : clip
              ),
            }
      )
    );
    setEditingClipId(null);
  }

  function deleteClip(clipId: string) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) => {
        if (idea.id !== songIdea.id) return idea;
        const remaining = idea.clips.filter((clip) => clip.id !== clipId);
        if (remaining.length > 0 && !remaining.some((clip) => clip.isPrimary)) {
          remaining[0] = { ...remaining[0], isPrimary: true };
        }
        return {
          ...idea,
          clips: remaining,
        };
      })
    );
  }

  const primaryEntry: RenderClipEntry | null = primaryClip
    ? {
        kind: "timeline",
        clip: primaryClip,
        depth: 0,
        childCount: 0,
        hasChildren: false,
      }
    : null;

  const listRows = useMemo<ClipListRow[]>(() => {
    const rows: ClipListRow[] = [];
    if (summaryContent) {
      rows.push({ kind: "summary-section" });
    }
    if (songIdea.kind === "project" && primaryEntry) {
      rows.push({ kind: "primary-section" });
    }
    rows.push({ kind: "ideas-header" });
    if (clipRows.length === 0) {
      rows.push({ kind: "empty" });
      return rows;
    }
    if (viewMode === "timeline" && timelineSortMetric === "created") {
      let lastDayStartTs: number | null = null;
      clipRows.forEach((row) => {
        if (row.kind !== "clip") return;
        const entry = row.entry;
        const nextDayStartTs = dayStartTs(entry.clip.createdAt);
        if (lastDayStartTs !== nextDayStartTs) {
          rows.push({
            kind: "day-divider",
            label: getDateDividerLabel(nextDayStartTs),
            dayStartTs: nextDayStartTs,
          });
          lastDayStartTs = nextDayStartTs;
        }
        rows.push(row);
      });
      return rows;
    }
    clipRows.forEach((row) => rows.push(row));
    return rows;
  }, [clipRows, primaryEntry, songIdea.kind, summaryContent, timelineSortMetric, viewMode]);

  const stickyIdeasIndex = useMemo(() => {
    let index = 0;
    if (summaryContent) index += 1;
    if (primaryEntry) index += 1;
    return index;
  }, [primaryEntry, summaryContent]);

  const viewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ClipListRow | null }> }) => {
      if (!onIdeasStickyChange) return;
      const visibleKinds = new Set(
        viewableItems
          .map((token) => token.item?.kind)
          .filter((kind): kind is ClipListRow["kind"] => !!kind)
      );
      const isSticky =
        visibleKinds.has("ideas-header") &&
        !visibleKinds.has("summary-section") &&
        !visibleKinds.has("primary-section");
      onIdeasStickyChange(isSticky);
    }
  );

  useEffect(() => {
    if (!onIdeasStickyChange) return;
    onIdeasStickyChange(false);
    return () => {
      onIdeasStickyChange(false);
    };
  }, [onIdeasStickyChange]);

  function openClipActions(clip: ClipVersion) {
    if (clipSelectionMode || isEditMode || isDraftProject || isParentPicking) return;
    setActionsClipId(clip.id);
  }

  function renderTimelineGuide() {
    return null;
  }

  function renderEvolutionGuide(entry: EvolutionClipEntry) {
    if (!entry.indented) return null;

    return (
      <View style={styles.songDetailEvolutionGuideWrap}>
        <View
          style={[
            styles.songDetailEvolutionStem,
            !entry.continuesThreadBelow ? styles.songDetailEvolutionStemEnd : null,
          ]}
        />
        {entry.indented ? (
          <View style={styles.songDetailEvolutionElbow}>
            <View style={styles.songDetailEvolutionDot} />
          </View>
        ) : null}
      </View>
    );
  }

  function renderClipCard(entry: RenderClipEntry) {
    const { clip } = entry;
    const inlineTarget = inlinePlayer.inlineTarget;
    const inlineActive = inlineTarget?.ideaId === songIdea.id && inlineTarget.clipId === clip.id;
    const isSelected = selectedClipIds.includes(clip.id);
    const isMoving = movingClipId === clip.id;
    const isPrimaryCandidate = displayPrimaryId === clip.id;
    const compactDensity = entry.kind === "evolution" ? entry.compactPreview : false;
    const isParentPickSource = parentPickSourceIdSet.has(clip.id);
    const isInvalidParentTarget =
      isParentPicking && parentPickInvalidTargetIdSet.has(clip.id);
    const isValidParentTarget = isParentPicking && !isInvalidParentTarget;

    return (
      <View style={styles.threadRowWrap}>
        <View
          style={[
            styles.selectionIndicatorCol,
            clipSelectionMode ? null : styles.selectionIndicatorHidden,
          ]}
        >
          {clipSelectionMode ? (
            <View
              style={[
                styles.selectionIndicatorCircle,
                isSelected ? styles.selectionIndicatorActive : null,
              ]}
            >
              {isSelected ? <Text style={styles.selectionBadgeText}>✓</Text> : null}
            </View>
          ) : null}
        </View>
        {entry.kind === "evolution" ? renderEvolutionGuide(entry) : renderTimelineGuide()}

        <View
          style={[
            styles.card,
            styles.cardFlex,
            styles.threadCard,
            styles.songDetailVersionCard,
            compactDensity ? styles.songDetailVersionCardCompact : null,
            isSelected || isMoving || isParentPickSource ? styles.cardSelected : null,
            isValidParentTarget ? styles.songDetailVersionCardParentTarget : null,
            isParentPicking && !isParentPickSource && isInvalidParentTarget
              ? styles.songDetailVersionCardParentTargetDisabled
              : null,
          ]}
        >
          <View style={styles.songDetailVersionRow}>
            <View
              style={[
                styles.songDetailVersionLead,
                inlineActive ? styles.songDetailVersionLeadInlineActive : null,
              ]}
            >
              {!clipSelectionMode && !isDraftProject && !isParentPicking ? (
                <Pressable
                  onPress={(evt) => {
                    evt.stopPropagation();
                    void Haptics.selectionAsync();
                    if (!clip.audioUri) return;
                    void inlinePlayer.toggleInlinePlayback(songIdea.id, clip);
                  }}
                  onLongPress={() => {
                    openClipActions(clip);
                  }}
                  style={({ pressed }) => [
                    styles.ideasInlinePlayBtn,
                    pressed ? styles.pressDown : null,
                  ]}
                >
                  <Text style={styles.inlinePlayBtnText}>
                    {inlineActive && inlinePlayer.isInlinePlaying ? "❚❚" : "▶"}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.ideasInlinePlayBtn}>
                <Text style={styles.inlinePlayBtnText}>▶</Text>
              </View>
            )}
              <View style={styles.songDetailVersionLeadDurationSlot}>
                <Text style={styles.songDetailVersionLeadDurationText}>
                  {clip.durationMs ? fmtDuration(clip.durationMs) : "0:00"}
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.songDetailVersionMain}
              onLongPress={() => {
                if (isParentPicking) {
                  return;
                }
                if (clipSelectionMode) {
                  useStore.getState().toggleClipSelection(clip.id);
                  return;
                }
                openClipActions(clip);
              }}
              onPress={async () => {
                if (isDraftProject) return;
                if (isParentPicking) {
                  if (isInvalidParentTarget) return;
                  onPickParentTarget(clip.id);
                  return;
                }
                if (clipSelectionMode) {
                  useStore.getState().toggleClipSelection(clip.id);
                  return;
                }
                if (isEditMode) {
                  beginEditingClip(clip);
                  return;
                }
                if (clip.audioUri) {
                  await inlinePlayer.resetInlinePlayer();
                  useStore.getState().setPlayerQueue([{ ideaId: songIdea.id, clipId: clip.id }], 0, true);
                  navigation.navigate("Player" as never);
                }
              }}
              delayLongPress={250}
            >
              {highlightMapRef.current[clip.id] ? (
                <Animated.View
                  style={[
                    styles.cardHighlightOverlay,
                    { opacity: highlightMapRef.current[clip.id] },
                  ]}
                  pointerEvents="none"
                />
              ) : null}

              {editingClipId === clip.id ? (
                <View style={styles.inputRow}>
                  <TitleInput
                    value={editingClipDraft}
                    onChangeText={setEditingClipDraft}
                    placeholder="Clip title"
                    containerStyle={{ marginHorizontal: 0, marginBottom: 8 }}
                  />
                  <TextInput
                    style={styles.notesInput}
                    multiline
                    placeholder="Clip notes"
                    value={editingClipNotesDraft}
                    onChangeText={setEditingClipNotesDraft}
                  />
                  <Button
                    variant="secondary"
                    label="Save"
                    onPress={() => saveEditingClip(clip.id)}
                  />
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onPress={() => setEditingClipId(null)}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.songDetailVersionTopRow}>
                    <View style={styles.songDetailVersionTitleRow}>
                      <Text style={styles.songDetailVersionTitle} numberOfLines={2}>
                        {clip.title}
                      </Text>
                    </View>

                    <View style={styles.songDetailVersionTrailing}>
                      {isParentPickSource ? (
                        <Text style={styles.badge}>SOURCE</Text>
                      ) : isEditMode ? (
                        isPrimaryCandidate ? (
                          <Text style={styles.badge}>PRIMARY</Text>
                        ) : (
                          <Pressable
                            style={styles.songDetailVersionSetPrimaryBtn}
                            onPress={() => useStore.getState().setPendingPrimaryClipId(clip.id)}
                          >
                            <Text style={styles.songDetailVersionSetPrimaryText}>Primary</Text>
                          </Pressable>
                        )
                      ) : clip.isPrimary ? (
                        <Text style={styles.badge}>PRIMARY</Text>
                      ) : null}

                      {!clipSelectionMode && !isEditMode && !isDraftProject && !isParentPicking ? (
                        <Pressable
                          style={({ pressed }) => [
                            styles.songDetailVersionReplyBtn,
                            compactDensity ? styles.songDetailVersionReplyBtnCompact : null,
                            pressed ? styles.pressDown : null,
                          ]}
                          onPress={async (evt) => {
                            evt.stopPropagation();
                            await inlinePlayer.resetInlinePlayer();
                            useStore.getState().setRecordingParentClipId(clip.id);
                            useStore.getState().setRecordingIdeaId(songIdea.id);
                            navigation.navigate("Recording" as never);
                          }}
                        >
                          <Ionicons
                            name="return-up-forward-outline"
                            size={14}
                            color="#475569"
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  <WaveformMiniPreview
                    peaks={clip.waveformPeaks}
                    compact={compactDensity}
                    bars={compactDensity ? 24 : 28}
                  />

                  <Text style={styles.songDetailVersionMeta}>{formatDate(clip.createdAt)}</Text>
                </>
              )}

              {inlineActive ? (
                <View style={styles.songDetailVersionInlinePlayerWrap}>
                  <MiniProgress
                    currentMs={inlinePlayer.inlinePosition}
                    durationMs={inlinePlayer.inlineDuration || clip.durationMs || 0}
                    onSeek={(ms) => {
                      void inlinePlayer.endInlineScrub(ms);
                    }}
                    onSeekStart={() => {
                      void inlinePlayer.beginInlineScrub();
                    }}
                    onSeekCancel={() => {
                      void inlinePlayer.cancelInlineScrub();
                    }}
                  />
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function renderEvolutionMoreRow(lineageRootId: string, hiddenCount: number) {
    const isExpanded = !!expandedBranchIds[lineageRootId];

    return (
      <View style={styles.threadRowWrap}>
        <View style={styles.selectionIndicatorCol} />
        <View style={styles.songDetailEvolutionMoreGuide}>
          <View style={styles.songDetailEvolutionMoreStem} />
          <View style={styles.songDetailEvolutionElbow}>
            <View style={styles.songDetailEvolutionDot} />
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.songDetailEvolutionMoreButtonWrap,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() =>
            setExpandedBranchIds((prev) => ({
              ...prev,
              [lineageRootId]: !prev[lineageRootId],
            }))
          }
        >
          <View style={styles.songDetailEvolutionMoreButton}>
            <Text style={styles.songDetailEvolutionMoreButtonText}>
              {isExpanded ? "Hide middle takes" : `${hiddenCount} more`}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={listRows}
        stickyHeaderIndices={[stickyIdeasIndex]}
        onViewableItemsChanged={viewableItemsChangedRef.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        keyExtractor={(row, index) => {
          if (row.kind === "clip") return `${row.entry.clip.id}-${row.entry.kind}-${index}`;
          if (row.kind === "day-divider") return `day-divider:${row.dayStartTs}`;
          return `${row.kind}-${index}`;
        }}
        style={styles.songDetailClipList}
        contentContainerStyle={styles.songDetailClipListContent}
        ListFooterComponent={<View style={{ height: footerSpacerHeight }} />}
        renderItem={({ item }) => {
          if (item.kind === "summary-section") {
            return summaryContent ? (
              <View style={styles.songDetailClipSummarySection}>{summaryContent}</View>
            ) : null;
          }

          if (item.kind === "primary-section") {
            return primaryEntry ? (
              <View style={styles.songDetailClipSection}>
                <View style={styles.songDetailSectionHeader}>
                  <View style={styles.songDetailSectionHeaderCopy}>
                    <Text style={styles.songDetailSectionTitle}>Primary take</Text>
                  </View>
                </View>
                {renderClipCard(primaryEntry)}
              </View>
            ) : null;
          }

          if (item.kind === "ideas-header") {
            return (
              <View style={styles.songDetailStickyIdeasHeader}>
                {isParentPicking ? (
                  <View style={styles.songDetailParentPickInlineHint}>
                    <Text style={styles.songDetailParentPickInlineTitle}>Choose parent clip</Text>
                    <Text style={styles.songDetailParentPickInlineText}>
                      Tap any available clip below.
                    </Text>
                  </View>
                ) : (
                  <ActionButtons
                    isEditMode={isEditMode}
                    clipViewMode={viewMode}
                    setClipViewMode={setViewMode}
                  timelineSortMetric={timelineSortMetric}
                  setTimelineSortMetric={setTimelineSortMetric}
                  timelineSortDirection={timelineSortDirection}
                  setTimelineSortDirection={setTimelineSortDirection}
                  timelineMainTakesOnly={timelineMainTakesOnly}
                  setTimelineMainTakesOnly={setTimelineMainTakesOnly}
                  clipTagFilter={clipTagFilter}
                  setClipTagFilter={setClipTagFilter}
                  visibleIdeaCount={visibleClipEntries.length}
                />
              )}
            </View>
            );
          }

          if (item.kind === "day-divider") {
            return (
              <View style={styles.songDetailTimelineDividerWrap}>
                <View style={styles.ideasDayDividerRow}>
                  <View style={styles.ideasDayDividerLine} />
                  <Text style={styles.ideasDayDividerText}>{item.label}</Text>
                  <View style={styles.ideasDayDividerLine} />
                </View>
              </View>
            );
          }

          if (item.kind === "evolution-more") {
            return renderEvolutionMoreRow(item.lineageRootId, item.hiddenCount);
          }

          if (item.kind === "empty") {
            return (
              <Text style={styles.emptyText}>
                {primaryEntry ? "No idea clips yet." : "No clips yet."}
              </Text>
            );
          }

          return renderClipCard(item.entry);
        }}
      />

      <ClipActionsSheet
        visible={!!actionsClip}
        title={actionsClip?.title ?? "Clip actions"}
        subtitle={
          actionsClip
            ? `${actionsClip.durationMs ? fmtDuration(actionsClip.durationMs) : "0:00"} • ${formatDate(actionsClip.createdAt)}`
            : undefined
        }
        onCancel={() => setActionsClipId(null)}
        actions={
          actionsClip
            ? [
                ...(!actionsClip.isPrimary
                  ? [
                      {
                        key: "set-parent",
                        label: actionsClip.parentClipId
                          ? "Change parent..."
                          : "Set parent...",
                        icon: "return-up-forward-outline" as const,
                        onPress: () => {
                          setActionsClipId(null);
                          onStartSetParent([actionsClip.id]);
                        },
                      },
                    ]
                  : []),
                ...(actionsClip.parentClipId
                  ? [
                      {
                        key: "make-root",
                        label: "Make root",
                        icon: "arrow-up-outline" as const,
                        onPress: () => {
                          setActionsClipId(null);
                          onMakeRoot([actionsClip.id]);
                        },
                      },
                    ]
                  : []),
                {
                  key: "record-variation",
                  label: "Record variation",
                  icon: "mic-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    void (async () => {
                      await inlinePlayer.resetInlinePlayer();
                      useStore.getState().setRecordingParentClipId(actionsClip.id);
                      useStore.getState().setRecordingIdeaId(songIdea.id);
                      navigation.navigate("Recording" as never);
                    })();
                  },
                },
                {
                  key: "rename",
                  label: "Rename",
                  icon: "pencil-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    beginEditingClip(actionsClip);
                  },
                },
                {
                  key: "add-notes",
                  label: "Add notes",
                  icon: "document-text-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    beginEditingClip(actionsClip);
                  },
                },
                {
                  key: "select",
                  label: "Select",
                  icon: "checkmark-circle-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    useStore.getState().startClipSelection(actionsClip.id);
                  },
                },
                {
                  key: "delete",
                  label: "Delete",
                  icon: "trash-outline" as const,
                  destructive: true,
                  onPress: () => {
                    setActionsClipId(null);
                    Alert.alert("Delete clip?", "This cannot be undone.", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          deleteClip(actionsClip.id);
                        },
                      },
                    ]);
                  },
                },
              ]
            : []
        }
      />
    </>
  );
}

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../../App";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { useInlinePlayer } from "../../hooks/useInlinePlayer";
import { buildClipLineages, type ClipLineage, type TimelineClipEntry } from "../../clipGraph";
import { type ClipVersion, type CustomTagDefinition } from "../../types";
import { fmtDuration, formatDate } from "../../utils";
import { ClipCard, type ClipCardSharedProps } from "../IdeaDetailScreen/ClipCard";
import { ClipActionsSheet } from "../modals/ClipActionsSheet";
import { ClipNotesSheet } from "../modals/ClipNotesSheet";
import { ClipTagPicker } from "../IdeaDetailScreen/ClipTagPicker";
import { AppAlert } from "../common/AppAlert";
import { useEffect } from "react";

type ClipLineageRoute = RouteProp<RootStackParamList, "ClipLineage">;
type SortMode = "chronological" | "custom";

export function ClipLineageScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<ClipLineageRoute>();
  const navigation = useNavigation();
  const inlinePlayer = useInlinePlayer();
  const inlineResetRef = useRef(inlinePlayer.resetInlinePlayer);

  const { ideaId, rootClipId } = route.params;
  const [sortMode, setSortMode] = useState<SortMode>("chronological");
  const [actionsClipId, setActionsClipId] = useState<string | null>(null);
  const [notesSheetClipId, setNotesSheetClipId] = useState<string | null>(null);
  const [tagPickerClipId, setTagPickerClipId] = useState<string | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingClipDraft, setEditingClipDraft] = useState("");
  const [editingClipNotesDraft, setEditingClipNotesDraft] = useState("");
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});

  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);

  const idea = useMemo(() => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    return ws?.ideas.find((i) => i.id === ideaId) ?? null;
  }, [workspaces, activeWorkspaceId, ideaId]);

  const lineage = useMemo<ClipLineage | null>(() => {
    if (!idea) return null;
    const lineages = buildClipLineages(idea.clips);
    return lineages.find((l) => l.root.id === rootClipId) ?? null;
  }, [idea, rootClipId]);

  const sortedClips = useMemo(() => {
    if (!lineage) return [];
    if (sortMode === "chronological") {
      return lineage.clipsOldestToNewest;
    }
    return [...lineage.clipsOldestToNewest].sort((a, b) => {
      const aOrder = a.manualSortOrder ?? a.createdAt;
      const bOrder = b.manualSortOrder ?? b.createdAt;
      return aOrder - bOrder;
    });
  }, [lineage, sortMode]);

  const clipEntries = useMemo<TimelineClipEntry[]>(
    () =>
      sortedClips.map((clip) => ({
        kind: "timeline" as const,
        clip,
        depth: 0,
        childCount: 0,
        hasChildren: false,
      })),
    [sortedClips]
  );

  useEffect(() => {
    inlineResetRef.current = inlinePlayer.resetInlinePlayer;
  }, [inlinePlayer.resetInlinePlayer]);

  // Back handler for inline player
  useEffect(() => {
    if (!inlinePlayer.inlineTarget) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      void inlineResetRef.current();
      return true;
    });
    return () => handler.remove();
  }, [inlinePlayer.inlineTarget]);

  // Tell GlobalMediaDock that inline player is visible
  const setInlinePlayerMounted = useStore((s) => s.setInlinePlayerMounted);
  useEffect(() => {
    setInlinePlayerMounted(true);
    return () => setInlinePlayerMounted(false);
  }, [setInlinePlayerMounted]);

  // Stop inline playback on unmount
  useEffect(() => {
    return () => {
      const { inlineTarget } = useStore.getState();
      if (inlineTarget) {
        useStore.getState().requestInlineStop();
      }
    };
  }, []);

  const actionsClip = actionsClipId
    ? idea?.clips.find((c) => c.id === actionsClipId) ?? null
    : null;
  const notesSheetClip = notesSheetClipId
    ? idea?.clips.find((c) => c.id === notesSheetClipId) ?? null
    : null;

  function beginEditingClip(clip: ClipVersion) {
    setEditingClipId(clip.id);
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
  }

  function saveEditingClip(clipId: string) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((i) =>
        i.id !== ideaId
          ? i
          : {
              ...i,
              clips: i.clips.map((clip) =>
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

  function openNotesSheet(clip: ClipVersion) {
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
    setNotesSheetClipId(clip.id);
  }

  function saveNotesSheet() {
    if (!notesSheetClipId) return;
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((i) =>
        i.id !== ideaId
          ? i
          : {
              ...i,
              clips: i.clips.map((clip) =>
                clip.id === notesSheetClipId
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
    setNotesSheetClipId(null);
  }

  function deleteClip(clipId: string) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((i) => {
        if (i.id !== ideaId) return i;
        const remaining = i.clips.filter((clip) => clip.id !== clipId);
        if (remaining.length > 0 && !remaining.some((clip) => clip.isPrimary)) {
          remaining[0] = { ...remaining[0], isPrimary: true };
        }
        return { ...i, clips: remaining };
      })
    );
  }

  const handleDragEnd = useCallback(
    ({ data }: { data: TimelineClipEntry[] }) => {
      const orderedIds = data.map((entry) => entry.clip.id);
      useStore.getState().setClipManualSortOrder(ideaId, orderedIds);
    },
    [ideaId]
  );

  if (!idea || !lineage) {
    return (
      <SafeAreaView style={[styles.screen, styles.screenProjectDetail]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={styles.emptyText}>Lineage not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const clipCardProps: ClipCardSharedProps = {
    idea,
    displayPrimaryId: null,
    isEditMode: false,
    isDraftProject: false,
    isParentPicking: false,
    parentPickSourceIdSet: new Set(),
    parentPickInvalidTargetIdSet: new Set(),
    editingClipId,
    editingClipDraft,
    setEditingClipDraft,
    editingClipNotesDraft,
    setEditingClipNotesDraft,
    onBeginEditing: beginEditingClip,
    onSaveEditing: saveEditingClip,
    onCancelEditing: () => setEditingClipId(null),
    onOpenActions: (clip) => setActionsClipId(clip.id),
    onOpenNotesSheet: (clip) => openNotesSheet(clip),
    onPickParentTarget: () => {},
    onOpenTagPicker: (clip) => setTagPickerClipId(clip.id),
    globalCustomTags,
    inlinePlayer,
    getHighlightValue: (clipId) => highlightMapRef.current[clipId],
  };

  const lineageTitle = lineage.root.title || "Untitled";
  const clipCount = lineage.clipsOldestToNewest.length;

  const renderDraggableItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<TimelineClipEntry>) => (
      <Pressable
        onLongPress={drag}
        delayLongPress={200}
        disabled={isActive}
        style={isActive ? { opacity: 0.9, transform: [{ scale: 1.02 }] } : undefined}
      >
        <ClipCard entry={item} {...clipCardProps} />
      </Pressable>
    ),
    [clipCardProps]
  );

  return (
    <SafeAreaView style={[styles.screen, styles.screenProjectDetail]}>
      {/* Header */}
      <View style={screenStyles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed ? styles.pressDown : null]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={screenStyles.headerTitleWrap}>
          <Text style={screenStyles.headerTitle} numberOfLines={1}>
            {lineageTitle}
          </Text>
          <Text style={screenStyles.headerSubtitle}>
            {clipCount} {clipCount === 1 ? "take" : "takes"} · {idea.title}
          </Text>
        </View>
      </View>

      {/* Sort mode toggle */}
      <View style={screenStyles.sortToggle}>
        {(["chronological", "custom"] as const).map((mode) => {
          const active = sortMode === mode;
          return (
            <Pressable
              key={mode}
              style={[
                screenStyles.sortTab,
                active ? screenStyles.sortTabActive : null,
              ]}
              onPress={() => setSortMode(mode)}
            >
              <Text
                style={[
                  screenStyles.sortTabText,
                  active ? screenStyles.sortTabTextActive : null,
                ]}
              >
                {mode === "chronological" ? "Chronological" : "Custom"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Clip list */}
      {sortMode === "custom" ? (
        <DraggableFlatList
          data={clipEntries}
          keyExtractor={(item) => item.clip.id}
          renderItem={renderDraggableItem}
          onDragEnd={handleDragEnd}
          style={styles.songDetailClipList}
          contentContainerStyle={[
            styles.songDetailClipListContent,
            { paddingBottom: 24 + Math.max(insets.bottom, 16) },
          ]}
        />
      ) : (
        <FlatList
          data={clipEntries}
          keyExtractor={(item) => item.clip.id}
          style={styles.songDetailClipList}
          contentContainerStyle={[
            styles.songDetailClipListContent,
            { paddingBottom: 24 + Math.max(insets.bottom, 16) },
          ]}
          renderItem={({ item }) => <ClipCard entry={item} {...clipCardProps} />}
        />
      )}

      {/* Clip actions sheet */}
      <ClipActionsSheet
        visible={!!actionsClip}
        title={actionsClip?.title ?? "Clip actions"}
        subtitle={
          actionsClip
            ? `${actionsClip.durationMs ? fmtDuration(actionsClip.durationMs) : "0:00"} · ${formatDate(actionsClip.createdAt)}`
            : undefined
        }
        onCancel={() => setActionsClipId(null)}
        actions={
          actionsClip
            ? [
                {
                  key: "record-variation",
                  label: "Record variation",
                  icon: "mic-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    void (async () => {
                      await inlinePlayer.resetInlinePlayer();
                      useStore.getState().setRecordingParentClipId(actionsClip.id);
                      useStore.getState().setRecordingIdeaId(idea.id);
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
                  label: actionsClip.notes?.trim() ? "Edit notes" : "Add notes",
                  icon: "document-text-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    openNotesSheet(actionsClip);
                  },
                },
                {
                  key: "delete",
                  label: "Delete",
                  icon: "trash-outline" as const,
                  destructive: true,
                  onPress: () => {
                    setActionsClipId(null);
                    AppAlert.destructive("Delete clip?", "This cannot be undone.", () => {
                      deleteClip(actionsClip.id);
                    });
                  },
                },
              ]
            : []
        }
      />

      <ClipTagPicker
        visible={!!tagPickerClipId}
        clip={
          tagPickerClipId
            ? idea.clips.find((c) => c.id === tagPickerClipId) ?? null
            : null
        }
        idea={idea}
        globalCustomTags={globalCustomTags}
        onClose={() => setTagPickerClipId(null)}
      />

      <ClipNotesSheet
        visible={!!notesSheetClip}
        clipSubtitle={
          notesSheetClip
            ? `${notesSheetClip.durationMs ? fmtDuration(notesSheetClip.durationMs) : "0:00"} · ${formatDate(notesSheetClip.createdAt)}`
            : ""
        }
        titleDraft={editingClipDraft}
        notesDraft={editingClipNotesDraft}
        onChangeTitle={setEditingClipDraft}
        onChangeNotes={setEditingClipNotesDraft}
        onSave={saveNotesSheet}
        onCancel={() => setNotesSheetClipId(null)}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

import { StyleSheet } from "react-native";

const screenStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "#64748b",
    marginTop: 1,
  },
  sortToggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: "#e8eaed",
    borderRadius: 10,
    padding: 3,
  },
  sortTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 8,
  },
  sortTabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  sortTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
  },
  sortTabTextActive: {
    color: "#0f172a",
  },
});

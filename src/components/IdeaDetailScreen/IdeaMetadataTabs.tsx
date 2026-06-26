import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useNavigation } from "@react-navigation/native";
import { styles } from "./styles";
import { appActions } from "../../state/actions";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { IdeaStatus, SongIdea } from "../../types";
import { StatusChipRow } from "../common/StatusChipRow";

type MetadataTabKey = "progress" | "lyrics" | "notes";

type IdeaMetadataTabsProps = {
  idea: SongIdea;
  isEditMode: boolean;
  draftStatus: IdeaStatus;
  setDraftStatus: (value: IdeaStatus) => void;
  draftCompletion: number;
  setDraftCompletion: (value: number) => void;
};

type MetadataActionChipProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
};

const PROJECT_STATUSES: IdeaStatus[] = ["seed", "sprout", "semi", "song"];

function getStatusChipStyles(status: IdeaStatus) {
  if (status === "song") return [styles.badge, styles.statusSong, styles.statusSongText];
  if (status === "semi") return [styles.badge, styles.statusSemi, styles.statusSemiText];
  if (status === "sprout") return [styles.badge, styles.statusSprout, styles.statusSproutText];
  return [styles.badge, styles.statusSeed, styles.statusSeedText];
}

function getStatusFromCompletion(value: number): IdeaStatus {
  if (value >= 75) return "song";
  if (value >= 50) return "semi";
  if (value >= 25) return "sprout";
  return "seed";
}

function stepCompletion(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 5) * 5));
}

function MetadataActionChip({
  label,
  icon,
  onPress,
  disabled = false,
}: MetadataActionChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.songDetailMetaActionChip,
        disabled ? styles.btnDisabled : null,
        pressed && !disabled ? styles.pressDown : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={14} color="#334155" />
      <Text style={styles.songDetailMetaActionChipText}>{label}</Text>
    </Pressable>
  );
}

export function IdeaMetadataTabs({
  idea,
  isEditMode,
  draftStatus,
  setDraftStatus,
  draftCompletion,
  setDraftCompletion,
}: IdeaMetadataTabsProps) {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<MetadataTabKey>(
    idea.kind === "project" ? "progress" : "notes"
  );
  const [notesDraft, setNotesDraft] = useState(idea.notes);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [liveCompletion, setLiveCompletion] = useState(idea.completionPct);

  const latestLyricsVersion = useMemo(() => getLatestLyricsVersion(idea), [idea]);
  const latestLyricsText = lyricsDocumentToText(latestLyricsVersion?.document).trim();
  const lyricsVersionCount = idea.kind === "project" ? idea.lyrics?.versions.length ?? 0 : 0;
  const tabs = useMemo<
    Array<{ key: MetadataTabKey; label: string }>
  >(
    () =>
      idea.kind === "project"
        ? [
            { key: "progress", label: "Progress" },
            { key: "lyrics", label: "Lyrics" },
            { key: "notes", label: "Notes" },
          ]
        : [{ key: "notes", label: "Notes" }],
    [idea.kind]
  );

  useEffect(() => {
    setLiveCompletion(idea.completionPct);
  }, [idea.completionPct, idea.id]);

  useEffect(() => {
    if (!isEditingNotes) {
      setNotesDraft(idea.notes);
    }
  }, [idea.notes, isEditingNotes]);

  useEffect(() => {
    if (idea.kind !== "project" && activeTab !== "notes") {
      setActiveTab("notes");
      return;
    }

    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0]?.key ?? "notes");
    }
  }, [activeTab, idea.kind, tabs]);

  function handleDraftCompletionChange(value: number) {
    const nextCompletion = stepCompletion(value);
    setDraftCompletion(nextCompletion);
    setDraftStatus(getStatusFromCompletion(nextCompletion));
  }

  function handleLiveCompletionCommit(value: number) {
    const nextCompletion = stepCompletion(value);
    setLiveCompletion(nextCompletion);
    appActions.setIdeaCompletion(nextCompletion);
  }

  function openLyricsEditor() {
    if (idea.kind !== "project" || idea.isDraft) return;
    navigation.navigate(lyricsVersionCount > 0 ? "Lyrics" : "LyricsVersion", {
      ideaId: idea.id,
      ...(lyricsVersionCount > 0
        ? {}
        : { createDraft: true, startInEdit: true, forceNewVersion: true }),
    });
  }

  function createLyricsVersion() {
    if (idea.kind !== "project" || idea.isDraft) return;
    navigation.navigate("LyricsVersion", {
      ideaId: idea.id,
      createDraft: true,
      startInEdit: true,
      forceNewVersion: true,
    });
  }

  function renderProgressPanel() {
    if (idea.kind !== "project") return null;

    if (isEditMode) {
      return (
        <View style={styles.songDetailMetaPanelBody}>
          <View style={styles.songDetailMetaCompactStatsRow}>
            <Text style={getStatusChipStyles(draftStatus)}>
              {draftStatus === "song" ? "SONG" : draftStatus.toUpperCase()}
            </Text>
            <Text style={styles.songDetailMetaValueCompact}>{draftCompletion}%</Text>
          </View>
          <StatusChipRow
            items={PROJECT_STATUSES}
            activeValue={draftStatus}
            stretch
            onPress={(status) => {
              setDraftStatus(status);
              if (status === "song") setDraftCompletion(75);
              else if (status === "semi") setDraftCompletion(50);
              else if (status === "sprout") setDraftCompletion(25);
              else setDraftCompletion(0);
            }}
          />
          <View style={styles.songDetailMetaSliderWrap}>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={draftCompletion}
              onValueChange={handleDraftCompletionChange}
              minimumTrackTintColor="#111827"
              maximumTrackTintColor="#d1d5db"
              thumbTintColor="#111827"
            />
          </View>
        </View>
      );
    }

    const currentStatus = getStatusFromCompletion(liveCompletion);

    return (
      <View style={styles.songDetailMetaPanelBody}>
        <View style={styles.songDetailMetaCompactStatsRow}>
          <Text style={getStatusChipStyles(currentStatus)}>
            {currentStatus === "song" ? "SONG" : currentStatus.toUpperCase()}
          </Text>
          <Text style={styles.songDetailMetaValueCompact}>{liveCompletion}%</Text>
        </View>
      </View>
    );
  }

  function renderLyricsPanel() {
    if (idea.kind !== "project") return null;

    return (
      <View style={styles.songDetailMetaPanelBody}>
        <View style={styles.songDetailMetaCompactStatsRow}>
          <Text style={styles.songDetailMetaValueCompact}>
            {lyricsVersionCount} {lyricsVersionCount === 1 ? "version" : "versions"}
          </Text>
        </View>
        <Text
          style={[
            styles.songDetailMetaPreview,
            !latestLyricsText ? styles.songDetailMetaPreviewMuted : null,
          ]}
          numberOfLines={2}
        >
          {idea.isDraft ? "Save song to add lyrics." : latestLyricsText || "No lyrics yet."}
        </Text>
        <View style={styles.songDetailMetaActionRow}>
          <MetadataActionChip
            label="Open"
            icon="document-text-outline"
            onPress={openLyricsEditor}
            disabled={!!idea.isDraft}
          />
          <MetadataActionChip
            label="New"
            icon="add-outline"
            onPress={createLyricsVersion}
            disabled={!!idea.isDraft}
          />
        </View>
      </View>
    );
  }

  function renderNotesPanel() {
    if (isEditingNotes && !isEditMode) {
      return (
        <View style={styles.songDetailMetaPanelBody}>
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder="Song notes"
            value={notesDraft}
            onChangeText={setNotesDraft}
          />
          <View style={styles.songDetailMetaActionRow}>
            <MetadataActionChip
              label="Cancel"
              icon="close-outline"
              onPress={() => {
                setNotesDraft(idea.notes);
                setIsEditingNotes(false);
              }}
            />
            <MetadataActionChip
              label="Save"
              icon="checkmark-outline"
              onPress={() => {
                appActions.setIdeaNotes(notesDraft);
                setIsEditingNotes(false);
              }}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.songDetailMetaPanelBody}>
        <Text
          style={[
            styles.songDetailMetaPreview,
            !idea.notes.trim() ? styles.songDetailMetaPreviewMuted : null,
          ]}
          numberOfLines={2}
        >
          {idea.notes.trim() || "No notes yet."}
        </Text>
        <View style={styles.songDetailMetaActionRow}>
          <MetadataActionChip
            label={idea.notes.trim() ? "Edit" : "Add"}
            icon="create-outline"
            onPress={() => setIsEditingNotes(true)}
            disabled={isEditMode}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.songDetailTopStack}>
      <View style={styles.songDetailMetaTabStrip}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.songDetailMetaTab,
                isActive ? styles.songDetailMetaTabActive : null,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.songDetailMetaTabText,
                  isActive ? styles.songDetailMetaTabTextActive : null,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.card, styles.songDetailMetaPanel]}>
        {activeTab === "progress"
          ? renderProgressPanel()
          : activeTab === "lyrics"
            ? renderLyricsPanel()
            : renderNotesPanel()}
      </View>
    </View>
  );
}

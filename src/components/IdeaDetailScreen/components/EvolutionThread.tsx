import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { type ClipLineage } from "../../../domain/clipGraph";
import { getClipPlaybackDurationMs, hasClipPlaybackSource } from "../../../domain/clipPresentation";
import { fmtCardDuration, formatClipDate } from "../../../utils";
import { type ClipVersion } from "../../../types";
import { type ClipCardContextProps } from "./ClipCard";
import { SongClipCard } from "./SongClipCard";
import { haptic } from "../../../design/haptics";
import { colors } from "../../../design/tokens";
import { UserText } from "../../../i18n";

type EvolutionThreadProps = {
  lineage: ClipLineage;
  expanded: boolean;
  onToggleExpanded: (lineageRootId: string) => void;
  context: ClipCardContextProps;
};

/** One quiet history row on the thread's stem: hollow node, version number,
 *  relative time, duration — tap to audition, long-press to select. The note
 *  (a clip's own notes field) hangs under it in earned serif. */
function StemVersionRow({
  clip,
  versionNumber,
  ideaId,
  context,
}: {
  clip: ClipVersion;
  versionNumber: number;
  ideaId: string;
  context: ClipCardContextProps;
}) {
  const { t } = useTranslation();
  const { inlinePlayer } = context.playback;
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const isSelected = useStore((s) => s.selectedClipIds.includes(clip.id));
  const toggleClipSelection = useStore((s) => s.toggleClipSelection);
  const startClipSelection = useStore((s) => s.startClipSelection);
  const inlineActive = useStore(
    (s) => s.inlineTarget?.ideaId === ideaId && s.inlineTarget.clipId === clip.id
  );
  const isInlinePlaying = useStore(
    (s) =>
      s.inlineTarget?.ideaId === ideaId &&
      s.inlineTarget.clipId === clip.id &&
      s.inlineIsPlaying
  );
  const durationMs = getClipPlaybackDurationMs(clip);
  const canPlay = hasClipPlaybackSource(clip);
  const note = (clip.notes ?? "").trim();

  const handlePress = () => {
    if (clipSelectionMode) {
      toggleClipSelection(clip.id);
      return;
    }
    if (!canPlay) return;
    haptic.tap();
    void inlinePlayer.toggleInlinePlayback(ideaId, clip);
  };
  const handleLongPress = () => {
    if (clipSelectionMode) {
      toggleClipSelection(clip.id);
      return;
    }
    haptic.grab();
    startClipSelection(clip.id);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.songDetailStemRow,
        isSelected ? styles.songDetailStemRowSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={t("clipLineage.versionA11y", { number: versionNumber })}
    >
      <View
        style={[
          styles.songDetailStemNode,
          inlineActive ? styles.songDetailStemNodeActive : null,
        ]}
      />
      <View style={styles.songDetailStemRowBody}>
        <View style={styles.songDetailStemRowTop}>
          <Text style={styles.songDetailStemVn}>{t("clipLineage.versionTag", { number: versionNumber })}</Text>
          <Text style={styles.songDetailStemWhen}>{formatClipDate(clip.createdAt)}</Text>
          {clip.isBookmarked ? (
            <Ionicons name="bookmark" size={11} color={colors.primary} />
          ) : null}
          <View style={{ flex: 1 }} />
          {inlineActive && isInlinePlaying ? (
            <Ionicons name="pause" size={12} color={colors.primaryDeep} />
          ) : null}
          <Text style={styles.songDetailStemDur}>
            {durationMs ? fmtCardDuration(durationMs) : "0:00"}
          </Text>
        </View>
        {note ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              context.actions.onOpenNotesSheet?.(clip);
            }}
            disabled={clipSelectionMode}
            hitSlop={{ top: 2, bottom: 4 }}
          >
            <UserText style={styles.songDetailStemNote} numberOfLines={1}>
              {note}
            </UserText>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * A multi-version lineage rendered as one object: tinted shell, the head card
 * playing the current version, a stem of older versions descending into the
 * past, and the thread's one forward action — "New version" — in the footer.
 * The stem never contains the future; actions aren't timeline events.
 */
export const EvolutionThread = React.memo(function EvolutionThread({
  lineage,
  expanded,
  onToggleExpanded,
  context,
}: EvolutionThreadProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const ideaId = context.mode.idea.id;
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const setRecordingParentClipId = useStore((s) => s.setRecordingParentClipId);
  const setRecordingIdeaId = useStore((s) => s.setRecordingIdeaId);

  const head = lineage.latestClip;
  const olderClips = lineage.clipsNewestToOldest.filter((clip) => clip.id !== head.id);
  const versionCount = lineage.clipsOldestToNewest.length;
  // v1 = oldest; the head is always vN.
  const versionNumberById = new Map(
    lineage.clipsOldestToNewest.map((clip, index) => [clip.id, index + 1])
  );
  const folded = olderClips.length > 1 && !expanded;

  const handleNewVersion = async () => {
    await context.playback.inlinePlayer.resetInlinePlayer();
    useStore.getState().requestPlayerClose();
    setRecordingParentClipId(head.id);
    setRecordingIdeaId(ideaId);
    navigation.navigate("Recording" as never);
  };

  return (
    <View style={styles.songDetailThreadShell}>
      <SongClipCard
        entry={{
          kind: "evolution",
          clip: head,
          lineageRootId: lineage.root.id,
          compactPreview: false,
          indented: false,
          continuesThreadBelow: false,
          hasOlderVersions: true,
          versionNumber: versionNumberById.get(head.id),
          versionCount,
        }}
        context={context}
      />

      <View style={styles.songDetailStem}>
        <View style={styles.songDetailStemLine} />
        {folded ? (
          <Pressable
            style={({ pressed }) => [styles.songDetailStemRow, pressed ? styles.pressDown : null]}
            onPress={() => {
              haptic.light();
              onToggleExpanded(lineage.root.id);
            }}
            accessibilityRole="button"
          >
            <View style={styles.songDetailStemNode} />
            <View style={styles.songDetailStemRowBody}>
              <View style={styles.songDetailStemRowTop}>
                <Text style={styles.songDetailStemFoldText}>
                  {t("clipLineage.olderVersions", { count: olderClips.length })}
                </Text>
                <Ionicons name="chevron-down" size={11} color={colors.textSecondary} />
              </View>
            </View>
          </Pressable>
        ) : (
          <>
            {olderClips.map((clip) => (
              <StemVersionRow
                key={clip.id}
                clip={clip}
                versionNumber={versionNumberById.get(clip.id) ?? 1}
                ideaId={ideaId}
                context={context}
              />
            ))}
            {olderClips.length > 1 ? (
              <Pressable
                style={({ pressed }) => [styles.songDetailStemHideRow, pressed ? styles.pressDown : null]}
                onPress={() => {
                  haptic.light();
                  onToggleExpanded(lineage.root.id);
                }}
                accessibilityRole="button"
              >
                <Ionicons name="chevron-up" size={11} color={colors.textSecondary} />
                <Text style={styles.songDetailStemFoldText}>{t("clipLineage.hideOlderVersions")}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {!clipSelectionMode ? (
        <Pressable
          style={({ pressed }) => [styles.songDetailThreadFoot, pressed ? styles.pressDown : null]}
          onPress={() => void handleNewVersion()}
          accessibilityRole="button"
          accessibilityLabel={t("clipLineage.newVersionA11y", { title: head.title })}
        >
          <Ionicons name="mic-outline" size={13} color={colors.primaryDeep} />
          <Text style={styles.songDetailThreadFootText}>{t("clipLineage.newVersion")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

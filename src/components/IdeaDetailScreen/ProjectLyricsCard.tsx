import React from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { SongIdea } from "../../types";
import { getLyricsPreview } from "../../lyrics";

type ProjectLyricsCardProps = {
  idea: SongIdea;
  disabled?: boolean;
  disabledReason?: string;
  cardStyle?: StyleProp<ViewStyle>;
  standalone?: boolean;
  previewLines?: number;
  compactRow?: boolean;
};

export function ProjectLyricsCard({
  idea,
  disabled = false,
  disabledReason,
  cardStyle,
  standalone = true,
  previewLines = 2,
  compactRow = false,
}: ProjectLyricsCardProps) {
  const navigation = useNavigation<any>();
  const versionCount = idea.lyrics?.versions.length ?? 0;
  const preview = getLyricsPreview(idea);
  const actionLabel = versionCount > 0 ? "Open" : "Start";

  if (compactRow) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          styles.songDetailSummaryLinkCard,
          cardStyle,
          disabled ? styles.btnDisabled : null,
          pressed && !disabled ? styles.pressDown : null,
        ]}
        disabled={disabled}
        onPress={() =>
          navigation.navigate(versionCount > 0 ? "Lyrics" : "LyricsVersion", {
            ideaId: idea.id,
            ...(versionCount > 0 ? {} : { createDraft: true, startInEdit: true, forceNewVersion: true }),
          })
        }
      >
        <View style={styles.songDetailSummaryLinkHeader}>
          <View style={styles.songDetailSummaryLinkLead}>
            <Ionicons
              name={versionCount > 0 ? "document-text" : "document-text-outline"}
              size={14}
              color="#64748b"
            />
            <Text style={styles.songDetailSummaryLinkTitle}>Lyrics</Text>
          </View>
          <View style={styles.songDetailSummaryLinkMetaWrap}>
            {versionCount > 0 ? (
              <Text style={styles.songDetailSummaryLinkMetaText}>
                {versionCount} {versionCount === 1 ? "ver" : "vers"}
              </Text>
            ) : null}
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
          </View>
        </View>
        <Text style={styles.songDetailSummaryLinkBody} numberOfLines={1}>
          {disabledReason
            ? disabledReason
            : preview || (versionCount > 0 ? "Open lyrics" : "Start lyrics")}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        styles.songDetailMiniCard,
        standalone ? styles.songDetailMiniCardStandalone : null,
        styles.songDetailLyricsCard,
        cardStyle,
        disabled ? styles.btnDisabled : null,
        pressed && !disabled ? styles.pressDown : null,
      ]}
      disabled={disabled}
      onPress={() =>
        navigation.navigate(versionCount > 0 ? "Lyrics" : "LyricsVersion", {
          ideaId: idea.id,
          ...(versionCount > 0 ? {} : { createDraft: true, startInEdit: true, forceNewVersion: true }),
        })
      }
    >
      <View style={styles.songDetailMiniCardHeader}>
        <View style={styles.songDetailMiniCardTitleWrap}>
          <Ionicons
            name={versionCount > 0 ? "document-text" : "document-text-outline"}
            size={14}
            color="#4b5563"
          />
          <Text style={styles.songDetailMiniCardTitle}>Lyrics</Text>
        </View>
        <View style={styles.songDetailMiniCardActionWrap}>
          {versionCount > 0 ? (
            <Text style={styles.songDetailMiniCardMetaText}>
              {versionCount} {versionCount === 1 ? "ver" : "vers"}
            </Text>
          ) : null}
          <Text style={styles.songDetailMiniCardActionText}>
            {actionLabel}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
        </View>
      </View>
      <Text style={styles.songDetailMiniCardBody} numberOfLines={previewLines}>
        {disabledReason
          ? disabledReason
          : preview || "No lyrics yet. Start a lyrics draft for this song."}
      </Text>
    </Pressable>
  );
}

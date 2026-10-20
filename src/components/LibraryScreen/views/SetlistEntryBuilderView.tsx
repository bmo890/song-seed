import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { colors, spacing, text as textTokens } from "../../../design/tokens";
import { fmtDuration } from "../../../utils";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

type BuilderSong = {
  title: string;
  clips: Array<{
    id: string;
    title: string;
    isPrimary: boolean;
    durationMs: number | null;
    sectionCount: number;
    pinCount: number;
  }>;
  versions: Array<{ id: string; label: string }>;
  hasChordSheet: boolean;
  hasNotes: boolean;
  notesPreview: string;
};

/** A choice on paper (2026-10-20, multi-select is editorial ink): the word
 *  and its quiet detail over a hairline, led by a dot that fills terracotta
 *  when chosen. No card, no washed selection. */
function CheckRow({
  label,
  detail,
  checked,
  onPress,
}: {
  label: string;
  detail?: string | null;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      // Haptics vocabulary: `light` — a small state flip (a choice ticked).
      haptic="light"
      style={builderStyles.row}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <Ionicons
        name={checked ? "ellipse" : "ellipse-outline"}
        size={14}
        color={checked ? colors.primary : colors.textMuted}
      />
      <View style={builderStyles.rowCopy}>
        <UserText style={builderStyles.rowLabel} numberOfLines={1}>
          {label}
        </UserText>
        {detail ? (
          <Text style={builderStyles.detailText} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Press>
  );
}

/** Repacking a song already in the set: choose the takes/parts, the charts,
 *  and the song notes — or grab Everything. A chosen take always brings its
 *  reel (sections, pins, take notes) along; version history stays home.
 *  Adding a song is no longer done here — that is the shared picker, like a
 *  playlist's (2026-10-11); this view opens from a row in edit mode. */
export function SetlistEntryBuilderView({
  song,
  clipIds,
  lyricVersionIds,
  includeChordSheet,
  includeSongNotes,
  onToggleClip,
  onToggleVersion,
  onToggleChordSheet,
  onToggleSongNotes,
  onSelectEverything,
  onConfirm,
}: {
  song: BuilderSong | null;
  clipIds: string[];
  lyricVersionIds: string[];
  includeChordSheet: boolean;
  includeSongNotes: boolean;
  onToggleClip: (clipId: string) => void;
  onToggleVersion: (versionId: string) => void;
  onToggleChordSheet: () => void;
  onToggleSongNotes: () => void;
  onSelectEverything: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  if (!song) return null;

  return (
    <View style={styles.flexFill}>
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.libraryScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={builderStyles.titleRow}>
          <UserText value={song.title} style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>
            {song.title}
          </UserText>
          <Press
            // Haptics vocabulary: `light` — every choice flips at once.
            haptic="light"
            style={builderStyles.everythingBtn}
            onPress={onSelectEverything}
            accessibilityRole="button"
            accessibilityLabel={t("library.includeEverything")}
          >
            <Text style={builderStyles.everythingLabel}>{t("library.everything")}</Text>
          </Press>
        </View>

        <Text style={builderStyles.sectionLabel}>{t("library.takesParts")}</Text>
        {song.clips.length === 0 ? (
          <Text style={styles.cardMeta}>{t("library.noClips")}</Text>
        ) : (
          <View style={builderStyles.list}>
            {song.clips.map((clip) => {
              const extras = [
                clip.sectionCount > 0
                  ? t("library.sections", { count: clip.sectionCount })
                  : null,
                clip.pinCount > 0 ? t("library.pins", { count: clip.pinCount }) : null,
                clip.durationMs != null ? fmtDuration(clip.durationMs) : null,
              ].filter(Boolean);
              return (
                <CheckRow
                  key={clip.id}
                  label={clip.isPrimary ? `${clip.title}  (${t("library.main")})` : clip.title}
                  detail={extras.length > 0 ? extras.join(" · ") : null}
                  checked={clipIds.includes(clip.id)}
                  onPress={() => onToggleClip(clip.id)}
                />
              );
            })}
          </View>
        )}

        <Text style={builderStyles.sectionLabel}>{t("library.chartsNotes")}</Text>
        <View style={builderStyles.list}>
          {song.versions.map((version) => (
            <CheckRow
              key={version.id}
              label={t("library.versionLyrics", { label: version.label })}
              checked={lyricVersionIds.includes(version.id)}
              onPress={() => onToggleVersion(version.id)}
            />
          ))}
          {song.hasChordSheet ? (
            <CheckRow label={t("library.chordChart")} checked={includeChordSheet} onPress={onToggleChordSheet} />
          ) : null}
          {song.hasNotes ? (
            <CheckRow
              label={t("library.songNotes")}
              detail={song.notesPreview ? `"${song.notesPreview}…"` : null}
              checked={includeSongNotes}
              onPress={onToggleSongNotes}
            />
          ) : null}
          {song.versions.length === 0 && !song.hasChordSheet && !song.hasNotes ? (
            <Text style={styles.cardMeta}>{t("library.noCharts")}</Text>
          ) : null}
        </View>

        <Text style={builderStyles.footnote}>
          {t("library.packFootnote")}
        </Text>
      </ScrollView>
      <View style={styles.inputRow}>
        <Button label={t("common.save")} onPress={onConfirm} />
      </View>
    </View>
  );
}

const builderStyles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // The quiet ink link beside the title: a word, no outline.
  everythingBtn: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  everythingLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primaryDeep,
  },
  sectionLabel: {
    ...textTokens.sectionTitle,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  detailText: {
    ...textTokens.caption,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  footnote: {
    ...textTokens.supporting,
    marginTop: spacing.lg,
  },
});

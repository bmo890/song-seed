import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
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
    <Pressable
      style={({ pressed }) => [
        styles.card,
        checked ? builderStyles.cardChecked : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {label}
          </Text>
          {detail ? (
            <Text style={builderStyles.detailText} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={checked ? "checkmark-circle" : "ellipse-outline"}
          size={20}
          color={checked ? colors.primary : colors.borderMuted}
        />
      </View>
    </Pressable>
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
          <Pressable
            style={({ pressed }) => [builderStyles.everythingBtn, pressed ? styles.pressDown : null]}
            onPress={onSelectEverything}
            accessibilityRole="button"
            accessibilityLabel={t("library.includeEverything")}
          >
            <Text style={builderStyles.everythingLabel}>{t("library.everything")}</Text>
          </Pressable>
        </View>

        <Text style={builderStyles.sectionLabel}>{t("library.takesParts")}</Text>
        {song.clips.length === 0 ? (
          <Text style={styles.cardMeta}>{t("library.noClips")}</Text>
        ) : (
          <View style={styles.listContent}>
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
        <View style={styles.listContent}>
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
  everythingBtn: {
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.round,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  everythingLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: colors.primaryDeep,
  },
  sectionLabel: {
    ...textTokens.annotation,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: 6,
  },
  cardChecked: {
    borderColor: "#EBD3CE",
    backgroundColor: "#FDF5F2",
  },
  detailText: {
    ...textTokens.caption,
    fontSize: 10,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  footnote: {
    ...textTokens.caption,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
    marginTop: spacing.lg,
    paddingHorizontal: 2,
  },
});

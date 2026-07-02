import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { haptic } from "../../../design/haptics";

const SONG_TABS = [
  { key: "takes", label: "Takes" },
  { key: "lyrics", label: "Lyrics" },
  { key: "chart", label: "Chart" },
  { key: "notes", label: "Notes" },
] as const;

function statusBadgeStyle(status: string) {
  switch (status) {
    case "song":
      return [styles.badge, styles.statusSong, styles.statusSongText];
    case "stem":
      return [styles.badge, styles.statusStem, styles.statusStemText];
    case "sprout":
      return [styles.badge, styles.statusSprout, styles.statusSproutText];
    default:
      return [styles.badge, styles.statusSeed, styles.statusSeedText];
  }
}

type SongCollapsibleHeaderProps = {
  /** Extra content rendered below the tabs (e.g. the primary-take strip on the takes tab). */
  extra?: ReactNode;
};

/**
 * The collapsible portion of the song-detail header: type eyebrow + large title
 * (+ progress strip for projects), the Takes/Lyrics/Notes tab switcher, and an
 * optional extra slot. Rendered inside `CollapsingHeaderOverlay` so it slides up
 * and clips away on scroll.
 */
export function SongCollapsibleHeader({ extra }: SongCollapsibleHeaderProps) {
  const { screen } = useSongScreen();
  const selectedIdea = screen.selectedIdea;
  if (!selectedIdea) return null;

  const isProject = selectedIdea.kind === "project";
  const titleLabel = isProject ? "Song" : "Clip";
  // In edit mode the title is edited in the fixed nav header, so the collapsible
  // title block + tabs are suppressed here to avoid a duplicate title.
  // Songs edit via a sheet, so their title + tabs stay visible while editing.
  // Clips still use the in-place edit (title moves into the nav), so hide there.
  const showTitle = isProject || !screen.isEditMode;
  const showTabs = isProject;

  return (
    // box-none + a non-interactive title lets drags on the title fall through to
    // the scroll view beneath, while the tabs and primary-strip buttons capture taps.
    <View pointerEvents="box-none">
      {showTitle ? (
        <View style={styles.songDetailTitleBlock} pointerEvents="none">
          <Text style={styles.songDetailTypeEyebrow}>{titleLabel}</Text>
          <Text style={styles.songDetailPageTitleLarge}>{selectedIdea.title}</Text>
          {isProject ? (
            <View style={styles.songDetailProgressStrip}>
              <Text style={styles.songDetailProgressStripLabel}>Progress</Text>
              <Text style={styles.songDetailProgressStripPercent}>
                {selectedIdea.completionPct}%
              </Text>
              <Text style={statusBadgeStyle(selectedIdea.status)}>
                {selectedIdea.status === "song" ? "SONG" : selectedIdea.status.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showTabs ? (
        <View style={styles.songDetailSongTabs}>
          {SONG_TABS.map((tab) => {
            const active = screen.songTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={({ pressed }) => [
                  styles.songDetailSongTab,
                  active ? styles.songDetailSongTabActive : null,
                  pressed && !active ? styles.pressDown : null,
                ]}
                onPress={() => {
                  if (active) return;
                  haptic.tap();
                  screen.setSongTab(tab.key);
                }}
              >
                <Text
                  style={[
                    styles.songDetailSongTabText,
                    active ? styles.songDetailSongTabTextActive : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {extra}
    </View>
  );
}

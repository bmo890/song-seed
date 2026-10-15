import { SegmentedControl } from "../../common/SegmentedControl";
import { Text, View } from "react-native";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { STAGE_INK, StageMark } from "../../common/StageMark";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";
import { formatLastEdited } from "../../../utils";
import { buildClipLineages } from "../../../domain/clipGraph";
import { type ClipVersion } from "../../../types";
import { PrimaryTakeLine } from "./PrimaryTakeLine";

const SONG_TABS = [
  { key: "takes", labelKey: "screens.takes" },
  { key: "lyrics", labelKey: "screens.lyrics" },
  { key: "chart", labelKey: "screens.chart" },
  { key: "notes", labelKey: "screens.notes" },
] as const;

type SongCollapsibleHeaderProps = {
  /** The Takes tab hands in the primary it shows (an edit may have staged a
   *  new one) and the way to find it in the list. Other tabs read the stored
   *  primary, and its name opens the Takes tab. */
  primaryClip?: ClipVersion | null;
  onLocatePrimary?: () => void;
};

/**
 * The collapsible portion of the song-detail header: large title, the meta
 * line, the primary take line (sketches), then the Takes/Lyrics/Chart/Notes
 * tabs. The primary line sits ABOVE the tabs and on every tab, so switching
 * tabs never moves them. Rendered inside `CollapsingHeaderOverlay` so it slides up
 * and clips away on scroll.
 */
export function SongCollapsibleHeader({ primaryClip, onLocatePrimary }: SongCollapsibleHeaderProps) {
  const { t } = useTranslation();
  const { screen } = useSongScreen();
  const selectedIdea = screen.selectedIdea;
  if (!selectedIdea) return null;

  const isProject = selectedIdea.kind === "project";
  // Takes = lineages (a take and its re-recordings count once), matching the
  // TAKES label on the list below — not raw clip versions.
  const takeCount = isProject ? buildClipLineages(selectedIdea.clips).length : 0;
  // In edit mode the title is edited in the fixed nav header, so the collapsible
  // title block + tabs are suppressed here to avoid a duplicate title.
  // Songs edit via a sheet, so their title + tabs stay visible while editing.
  // Clips still use the in-place edit (title moves into the nav), so hide there.
  const showTitle = isProject || !screen.isEditMode;
  const showTabs = isProject;
  const primary =
    primaryClip !== undefined
      ? primaryClip
      : isProject
        ? selectedIdea.clips.find((clip) => clip.isPrimary) ?? null
        : null;

  return (
    // box-none + a non-interactive title lets drags on the title fall through to
    // the scroll view beneath, while the tabs and the primary line capture taps.
    <View pointerEvents="box-none">
      {showTitle ? (
        <View style={styles.songDetailTitleBlock} pointerEvents="none">
          {/* The type now rides in the nav row's back label ("‹ IDEAS · SKETCH"), so
              the title stands alone here (2026-09-07). */}
          <UserText style={styles.songDetailPageTitleLarge}>{selectedIdea.title}</UserText>
          {isProject ? (
            <View style={styles.songDetailProgressStrip}>
              {/* Stage as editorial ink (dial + word in the stage's warm hue) —
                  display-only here; the stage is changed in the edit sheet. It
                  leads a quiet meta line: stage · takes · last edit. */}
              <View style={styles.songDetailStageInk}>
                <StageMark status={selectedIdea.status} size={12} />
                <Text
                  style={[
                    styles.songDetailStageInkText,
                    { color: STAGE_INK[selectedIdea.status] ?? colors.textMuted },
                  ]}
                >
                  {t(`stages.${selectedIdea.status}`)}
                </Text>
              </View>
              <Text style={styles.songDetailMetaLine} numberOfLines={1}>
                {"·  " +
                  [
                    t("brand.takeCount", { count: takeCount }),
                    formatLastEdited(selectedIdea.lastActivityAt),
                  ].join("  ·  ")}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showTitle && isProject && primary ? (
        <PrimaryTakeLine clip={primary} onLocate={onLocatePrimary} />
      ) : null}

      {showTabs ? (
        // The shared tab control (2026-10-15): it was a hand-built copy of the
        // segmented track; now the same ink tabs as every other choice.
        <View style={styles.songDetailSongTabs}>
          <SegmentedControl
            options={SONG_TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey) }))}
            selectedKey={screen.songTab}
            onSelect={(key) => screen.setSongTab(key)}
          />
        </View>
      ) : null}
    </View>
  );
}

import { useState } from "react";
import { Pressable, View } from "react-native";
import { useStore } from "../../../../state/useStore";
import type { CustomTagDefinition } from "../../../../types";
import { styles } from "../../styles";
import { useSongScreen } from "../../provider/SongScreenProvider";
import { getSongTimelineSortMetricIcon } from "../../songClipControls";
import { SongClipFilterMenu } from "./SongClipFilterMenu";
import { SongClipFilterTrigger } from "./SongClipFilterTrigger";
import { SongClipSortMenu } from "./SongClipSortMenu";
import { SongClipSortTrigger } from "./SongClipSortTrigger";
import { SongClipViewToggle } from "./SongClipViewToggle";
import { songClipToolbarStyles } from "./styles";

type SongClipToolbarControlsProps = {
  projectCustomTags: CustomTagDefinition[];
};

export function SongClipToolbarControls({
  projectCustomTags,
}: SongClipToolbarControlsProps) {
  const { screen } = useSongScreen();
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const isFilterActive =
    screen.clipTagFilter !== "all" ||
    (screen.clipViewMode === "timeline" && screen.timelineMainTakesOnly);
  const isSortActive =
    screen.clipViewMode === "timeline" &&
    (screen.timelineSortMetric !== "created" || screen.timelineSortDirection !== "desc");

  const closeMenus = () => {
    setFilterMenuOpen(false);
    setSortMenuOpen(false);
  };

  return (
    <View style={songClipToolbarStyles.controlsRow}>
      {filterMenuOpen || sortMenuOpen ? (
        <Pressable style={styles.ideasToolbarBackdrop} onPress={closeMenus} />
      ) : null}

      <View style={styles.ideasUtilityRowLeft}>
        <SongClipFilterTrigger
          active={isFilterActive}
          open={filterMenuOpen}
          onPress={() => {
            setFilterMenuOpen((prev) => !prev);
            setSortMenuOpen(false);
          }}
          onClear={() => {
            screen.setClipTagFilter("all");
            screen.setTimelineMainTakesOnly(false);
          }}
        />

        {screen.clipViewMode === "timeline" ? (
          <SongClipSortTrigger
            active={isSortActive}
            open={sortMenuOpen}
            direction={screen.timelineSortDirection}
            metricIcon={getSongTimelineSortMetricIcon(screen.timelineSortMetric) as any}
            onPress={() => {
              setSortMenuOpen((prev) => !prev);
              setFilterMenuOpen(false);
            }}
          />
        ) : null}
      </View>

      <SongClipViewToggle
        clipViewMode={screen.clipViewMode}
        setClipViewMode={screen.setClipViewMode}
      />

      {filterMenuOpen ? (
        <SongClipFilterMenu
          clipViewMode={screen.clipViewMode}
          clipTagFilter={screen.clipTagFilter}
          setClipTagFilter={screen.setClipTagFilter}
          timelineMainTakesOnly={screen.timelineMainTakesOnly}
          setTimelineMainTakesOnly={screen.setTimelineMainTakesOnly}
          projectCustomTags={projectCustomTags}
          globalCustomTags={globalCustomTags}
          onClose={() => setFilterMenuOpen(false)}
        />
      ) : null}

      {sortMenuOpen ? (
        <SongClipSortMenu
          timelineSortMetric={screen.timelineSortMetric}
          setTimelineSortMetric={screen.setTimelineSortMetric}
          timelineSortDirection={screen.timelineSortDirection}
          setTimelineSortDirection={screen.setTimelineSortDirection}
          onClose={() => setSortMenuOpen(false)}
        />
      ) : null}
    </View>
  );
}

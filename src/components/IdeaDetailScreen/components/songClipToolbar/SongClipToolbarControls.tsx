import { useState } from "react";
import { Pressable, View } from "react-native";
import { useStore } from "../../../../state/useStore";
import type { CustomTagDefinition } from "../../../../types";
import { styles } from "../../styles";
import { useSongScreen } from "../../provider/SongScreenProvider";
import { SongClipFilterMenu } from "./SongClipFilterMenu";
import { SongClipFilterTrigger } from "./SongClipFilterTrigger";
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
  const filterActive = screen.clipTagFilter.length > 0;

  return (
    <View style={songClipToolbarStyles.controlsRow}>
      {/* Close filter menu on outside tap */}
      {filterMenuOpen ? (
        <Pressable style={styles.ideasToolbarBackdrop} onPress={() => setFilterMenuOpen(false)} />
      ) : null}

      <View style={songClipToolbarStyles.controlsRight}>
        {/* Arrange — single tap toggles asc ↔ desc, no dropdown */}
        <SongClipSortTrigger
          direction={screen.timelineSortDirection}
          onPress={() =>
            screen.setTimelineSortDirection(
              screen.timelineSortDirection === "desc" ? "asc" : "desc"
            )
          }
        />

        {/* Tag filter multiselect dropdown */}
        <View style={{ position: "relative" }}>
          <SongClipFilterTrigger
            active={filterActive}
            open={filterMenuOpen}
            onPress={() => setFilterMenuOpen((prev) => !prev)}
            onClear={() => screen.setClipTagFilter([])}
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
        </View>
      </View>

      {/* Layout toggle — direct click, no dropdown */}
      <SongClipViewToggle
        clipViewMode={screen.clipViewMode}
        setClipViewMode={screen.setClipViewMode}
      />
    </View>
  );
}

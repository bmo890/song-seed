import { useState } from "react";
import { Pressable, View } from "react-native";
import { useStore } from "../../../../state/useStore";
import type { ClipGroup, CustomTagDefinition } from "../../../../types";
import { styles } from "../../styles";
import { HelpButton } from "../../../common/HelpButton";
import { useSongScreen } from "../../provider/SongScreenProvider";
import { TakesHelpSheet } from "../TakesHelpSheet";
import { SongClipFilterMenu } from "./SongClipFilterMenu";
import { SongClipFilterTrigger } from "./SongClipFilterTrigger";
import { SongClipSortTrigger } from "./SongClipSortTrigger";
import { SongClipViewToggle } from "./SongClipViewToggle";
import { songClipToolbarStyles } from "./styles";

type SongClipToolbarControlsProps = {
  projectCustomTags: CustomTagDefinition[];
  clipGroups: ClipGroup[];
};

export function SongClipToolbarControls({
  projectCustomTags,
  clipGroups,
}: SongClipToolbarControlsProps) {
  const { screen } = useSongScreen();
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const seenHints = useStore((s) => s.seenHints);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const filterActive =
    screen.clipTagFilter.length > 0 ||
    screen.clipGroupFilter.length > 0 ||
    screen.clipBookmarkedOnly;

  // First-visit teaching (welcome wizard v2): the "?" wears a quiet wash until
  // opened once, and re-lights once more when the sketch gains its second take —
  // the moment versioning becomes real. Opening the sheet settles both.
  const takeCount = screen.selectedIdea?.clips?.length ?? 0;
  const helpEmphasized =
    !seenHints.includes("takesHelp") ||
    (takeCount >= 2 && !seenHints.includes("takesHelpSecondTake"));
  const openHelp = () => {
    const { markHintSeen } = useStore.getState();
    markHintSeen("takesHelp");
    if (takeCount >= 2) markHintSeen("takesHelpSecondTake");
    setHelpVisible(true);
  };

  return (
    <View style={songClipToolbarStyles.controlsRow}>
      {/* Close filter menu on outside tap */}
      {filterMenuOpen ? (
        <Pressable style={styles.ideasToolbarBackdrop} onPress={() => setFilterMenuOpen(false)} />
      ) : null}

      {/* View switch leads; utility glyphs sit quietly on the trailing edge
          (collection toolbar language). Bounded so the glyphs never get pushed
          off-screen by the flex segments. */}
      <View style={songClipToolbarStyles.viewToggleWrap}>
        <SongClipViewToggle
          clipViewMode={screen.clipViewMode}
          setClipViewMode={screen.setClipViewMode}
        />
      </View>

      <View style={songClipToolbarStyles.controlsRight}>
        {/* The takes legend — versions, primary take, branch vs split */}
        <HelpButton onPress={openHelp} emphasized={helpEmphasized} size={18} />

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
            onClear={() => {
              screen.setClipTagFilter([]);
              screen.setClipGroupFilter([]);
              screen.setClipBookmarkedOnly(false);
            }}
          />
          {filterMenuOpen ? (
            <SongClipFilterMenu
              clipViewMode={screen.clipViewMode}
              clipTagFilter={screen.clipTagFilter}
              setClipTagFilter={screen.setClipTagFilter}
              clipGroupFilter={screen.clipGroupFilter}
              setClipGroupFilter={screen.setClipGroupFilter}
              clipBookmarkedOnly={screen.clipBookmarkedOnly}
              setClipBookmarkedOnly={screen.setClipBookmarkedOnly}
              clipGroups={clipGroups}
              timelineMainTakesOnly={screen.timelineMainTakesOnly}
              setTimelineMainTakesOnly={screen.setTimelineMainTakesOnly}
              projectCustomTags={projectCustomTags}
              globalCustomTags={globalCustomTags}
              onClose={() => setFilterMenuOpen(false)}
            />
          ) : null}
        </View>
      </View>

      <TakesHelpSheet visible={helpVisible} onClose={() => setHelpVisible(false)} />
    </View>
  );
}

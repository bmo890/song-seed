import { LyricsVersionsPanel } from "../../LyricsScreen/LyricsVersionsPanel";
import { styles } from "../styles";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingTabStage } from "../components/CollapsingTabStage";

export function SongLyricsSection() {
  const { screen } = useSongScreen();
  if (screen.selectedIdea?.kind !== "project" || screen.songTab !== "lyrics") {
    return null;
  }

  return (
    <CollapsingTabStage
      contentContainerStyle={[
        styles.songDetailTabScrollContent,
        { paddingBottom: screen.songPageBaseBottomPadding },
      ]}
    >
      <LyricsVersionsPanel projectIdea={screen.selectedIdea} />
    </CollapsingTabStage>
  );
}

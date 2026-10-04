import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { LyricsVersionsPanel } from "../../LyricsScreen/LyricsVersionsPanel";
import { InkLink } from "../../common/InkLink";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingTabStage } from "../components/CollapsingTabStage";

export function SongLyricsSection() {
  const { t } = useTranslation();
  const { screen, actions } = useSongScreen();
  if (screen.selectedIdea?.kind !== "project" || screen.songTab !== "lyrics") {
    return null;
  }

  // Writing against the tape lives in the full player (the slim reel with its
  // loop is the whole point). The tab offers the door, quietly, only when there
  // is a take to hear — the versions below are the tab's own job (2026-10-03).
  const canWriteWithTape = actions.buildProjectQueue().length > 0;
  const writeWithTape = () => {
    useStore.getState().setPlayerOpenIntent("write");
    actions.playProjectQueue();
  };

  return (
    <CollapsingTabStage
      contentContainerStyle={[
        styles.songDetailTabScrollContent,
        { paddingBottom: screen.songPageBaseBottomPadding },
      ]}
    >
      {canWriteWithTape ? (
        <View style={styles.songDetailTabLinkRow}>
          <InkLink
            icon="play-outline"
            label={t("songDetail.writeWithTape")}
            onPress={writeWithTape}
            testID="song-lyrics-write-with-tape"
          />
        </View>
      ) : null}
      <LyricsVersionsPanel projectIdea={screen.selectedIdea} />
    </CollapsingTabStage>
  );
}

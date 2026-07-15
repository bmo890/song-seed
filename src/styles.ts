import { StyleSheet } from "react-native";

import { baseStyles } from "./styles/base";
import { ideasStyles } from "./styles/ideas";
import { ideasListStyles } from "./styles/ideasList";
import { songDetailStyles } from "./styles/songDetail";
import { songDetailHistoryStyles } from "./styles/songDetailHistory";
import { recordingStyles } from "./styles/recording";
import { playerStyles } from "./styles/player";
import { lyricsStyles } from "./styles/lyrics";
import { clipsStyles } from "./styles/clips";
import { selectionStyles } from "./styles/selection";
import { libraryStyles } from "./styles/library";
import { activityStyles } from "./styles/activity";
import { settingsStyles } from "./styles/settings";

// One flat, app-wide sheet. The style objects live in src/styles/* by domain;
// they are merged here so every consumer keeps importing { styles } unchanged
// and StyleSheet.create still runs exactly once.
export const styles = StyleSheet.create({
  ...baseStyles,
  ...ideasStyles,
  ...ideasListStyles,
  ...songDetailStyles,
  ...songDetailHistoryStyles,
  ...recordingStyles,
  ...playerStyles,
  ...lyricsStyles,
  ...clipsStyles,
  ...selectionStyles,
  ...libraryStyles,
  ...activityStyles,
  ...settingsStyles,
});

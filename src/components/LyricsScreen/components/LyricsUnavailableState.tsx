import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";

export function LyricsUnavailableState() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Lyrics" leftIcon="back" />
      <Text style={styles.emptyText}>Lyrics are only available inside a song.</Text>
      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

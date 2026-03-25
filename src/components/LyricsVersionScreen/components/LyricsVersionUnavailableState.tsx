import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";

export function LyricsVersionUnavailableState() {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader title="Lyrics Version" leftIcon="back" />
      <Text style={styles.emptyText}>This lyrics version is no longer available.</Text>
      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

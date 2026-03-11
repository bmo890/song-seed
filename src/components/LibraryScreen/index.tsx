import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { styles } from "../../styles";

export function LibraryScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Library" leftIcon="hamburger" />
      <AppBreadcrumbs
        items={[
          { key: "home", label: "Home", level: "home" },
          { key: "library", label: "Library", level: "library", active: true },
        ]}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Library is coming next</Text>
        <Text style={styles.cardMeta}>
          Saved playlists and longer listening flows will live here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

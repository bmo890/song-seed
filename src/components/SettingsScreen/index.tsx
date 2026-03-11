import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { styles } from "../../styles";

export function SettingsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Settings" leftIcon="hamburger" />
      <AppBreadcrumbs
        items={[
          { key: "home", label: "Home", level: "home" },
          { key: "settings", label: "Settings", level: "settings", active: true },
        ]}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settings are coming next</Text>
        <Text style={styles.cardMeta}>
          App preferences, device routing, and defaults will live here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

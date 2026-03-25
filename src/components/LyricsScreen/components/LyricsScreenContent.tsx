import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { ScreenHeader } from "../../common/ScreenHeader";
import { AppBreadcrumbs } from "../../common/AppBreadcrumbs";
import { LyricsVersionsPanel } from "../LyricsVersionsPanel";
import { useLyricsScreenModel } from "../hooks/useLyricsScreenModel";
import { LyricsUnavailableState } from "./LyricsUnavailableState";

export function LyricsScreenContent() {
  const { projectIdea, versionCount, breadcrumbItems } = useLyricsScreenModel();

  if (!projectIdea) return <LyricsUnavailableState />;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title="Lyrics"
        leftIcon="back"
        rightElement={
          <View style={styles.contextPill}>
            <Ionicons name="book-outline" size={12} color="#4b5563" />
            <Text style={styles.contextPillText}>{versionCount} {versionCount === 1 ? "PAGE" : "PAGES"}</Text>
          </View>
        }
      />

      {breadcrumbItems.length > 0 ? <AppBreadcrumbs items={breadcrumbItems} /> : null}

      <Text style={styles.subtitle}>{projectIdea.title}</Text>

      <ScrollView contentContainerStyle={styles.lyricsScreenContent}>
        <LyricsVersionsPanel projectIdea={projectIdea} />
      </ScrollView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

import { Linking, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ScreenHeader } from "../../common/ScreenHeader";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useTunerScreenModel } from "../hooks/useTunerScreenModel";
import { styles } from "../styles";
import { TunerDial } from "./TunerDial";

export function TunerScreenContent() {
  useBrowseRootBackHandler();
  const model = useTunerScreenModel();

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Tuner" leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
      >
        <TunerDial model={model} />

        <Text style={styles.helperText}>
          Hold the phone near your instrument and let one string ring at a time.
        </Text>

        {model.errorMessage ? (
          <Text
            style={styles.errorText}
            onPress={() => {
              if (model.permissionBlocked) {
                void Linking.openSettings();
              }
            }}
          >
            {model.errorMessage}
            {model.permissionBlocked ? " Tap to open settings." : ""}
          </Text>
        ) : null}
      </ScrollView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

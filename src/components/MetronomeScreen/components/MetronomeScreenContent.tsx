import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";
import { useMetronomeScreenModel } from "../hooks/useMetronomeScreenModel";
import { MetronomeHero } from "./MetronomeHero";
import { MetronomeMeterSection } from "./MetronomeMeterSection";
import { MetronomeTempoSection } from "./MetronomeTempoSection";
import { MetronomeTapTempoSection } from "./MetronomeTapTempoSection";
import { MetronomeOutputsSection } from "./MetronomeOutputsSection";

export function MetronomeScreenContent() {
  const model = useMetronomeScreenModel();

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Metronome" leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
      >
        <MetronomeHero model={model} />

        <View style={styles.divider} />

        <MetronomeTempoSection
          bpm={model.bpm}
          onNudge={model.nudgeBpm}
          onChangeValue={model.setBpmValue}
        />

        <MetronomeTapTempoSection
          tapCount={model.tapCount}
          onTapTempo={model.tapTempo}
          onReset={model.clearTapTempo}
        />

        <View style={styles.divider} />

        <MetronomeMeterSection
          meterId={model.meterId}
          onSelectMeter={model.setMeterIdValue}
        />

        <View style={styles.divider} />

        <MetronomeOutputsSection
          outputs={model.outputs}
          activeOutputCount={model.activeOutputCount}
          beepLevel={model.beepLevel}
          hapticLevel={model.hapticLevel}
          onToggleOutput={model.toggleOutput}
          onChangeBeepLevel={model.setBeepLevelValue}
          onChangeHapticLevel={model.setHapticLevelValue}
        />
      </ScrollView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

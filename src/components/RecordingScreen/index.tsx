import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { QuickNameModal } from "../modals/QuickNameModal";
import { RecordingHeader } from "./RecordingHeader";
import { RecordingBody } from "./RecordingBody";
import { RecordingBottomDock } from "./RecordingBottomDock";
import { RecordingSettingsModal } from "./RecordingSettingsModal";
import { useRecordingScreenModel } from "./hooks/useRecordingScreenModel";

export function RecordingScreen() {
  const navigation = useNavigation();
  const screen = useRecordingScreenModel();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.recordingScreenLayout}>
        <RecordingHeader
          title={screen.recordingIdea?.title || "Recording"}
          controlsDisabled={screen.recordingControlsDisabled}
          onBack={screen.confirmDiscardAndExit}
          onMinimize={screen.minimizeRecording}
          onOpenSettings={() => screen.setSettingsVisible(true)}
        />

        <RecordingBody
          recordingIdea={screen.recordingIdea ?? null}
          recordingOverdubClip={screen.recordingOverdubClip ?? null}
          guideMixIsPlaying={screen.guideMixIsPlaying}
          guideMixPositionMs={screen.guideMixPositionMs}
          guideMixDurationMs={screen.guideMixDurationMs}
          guideMixWaveformPeaks={screen.guideMixWaveformPeaks}
          isBluetoothRecordingInput={screen.isBluetoothRecordingInput}
          isBluetoothMonitoringOutput={screen.isBluetoothMonitoringOutput}
          recordingInputLabel={screen.recordingInputLabel}
          monitoringOutputLabel={screen.monitoringOutputLabel}
          activeBluetoothCalibrationMs={screen.activeBluetoothCalibrationMs}
          hasProjectLyrics={screen.hasProjectLyrics}
          latestLyricsText={screen.latestLyricsText}
          latestLyricsUpdatedAt={screen.latestLyricsVersion?.updatedAt ?? null}
          lyricsExpanded={screen.lyricsExpanded}
          lyricsAutoscrollMode={screen.lyricsAutoscrollMode}
          lyricsAutoscrollSpeedMultiplier={screen.lyricsAutoscrollSpeedMultiplier}
          isRecording={screen.recording.isRecording}
          isPaused={screen.recording.isPaused}
          elapsedMs={screen.recording.elapsedMs}
          isCountIn={screen.metronome.isCountIn}
          countInBars={screen.metronome.countInBars}
          countInCurrentBar={screen.metronome.currentBar}
          countInCurrentBeat={screen.metronome.currentBeatInBar}
          countInBeatsPerBar={screen.metronome.meterPreset.pulsesPerBar}
          waveformData={screen.recording.liveWaveformData ?? screen.recording.analysisData}
          onToggleLyricsExpanded={screen.setLyricsExpanded}
          onToggleLyricsAutoscroll={(enabled) =>
            screen.setLyricsAutoscrollMode(enabled ? "follow" : "off")
          }
          onLyricsAutoscrollInterrupted={() => screen.setLyricsAutoscrollMode("manual")}
          onSelectLyricsAutoscrollSpeedMultiplier={screen.setLyricsAutoscrollSpeedMultiplier}
          onOpenBluetoothCalibration={() => navigation.navigate("BluetoothCalibration" as never)}
        />

        <RecordingBottomDock
          metronomeEnabled={screen.recordingMetronomeEnabled}
          metronomeControlsDisabled={screen.recordingControlsDisabled}
          metronome={{
            bpm: screen.metronome.bpm,
            meterId: screen.metronome.meterId,
            countInBars: screen.metronome.countInBars,
            outputs: screen.metronome.outputs,
            tapCount: screen.metronome.tapCount,
            isNativeAvailable: screen.metronome.isNativeAvailable,
            onToggleEnabled: screen.setRecordingMetronomeEnabled,
            onNudgeBpm: screen.metronome.nudgeBpm,
            onSetBpmValue: screen.metronome.setBpmValue,
            onTapTempo: screen.metronome.tapTempo,
            onResetTapTempo: screen.metronome.clearTapTempo,
            onSelectMeter: screen.metronome.setMeterIdValue,
            onSelectCountInBars: screen.metronome.setCountInBarsValue,
            onToggleOutput: screen.metronome.toggleOutput,
          }}
          recording={{
            isRecording: screen.recording.isRecording,
            isPaused: screen.recording.isPaused,
            isArming: screen.isArmingRecording,
            isReviewLocked: screen.overdubReviewLocked,
            onOpenInput: () => screen.setSettingsVisible(true),
            onPause: screen.handlePauseRecording,
            onResume: screen.handleResumeRecording,
            onStart: screen.handleStartRecording,
            onRequestSave: screen.requestSaveRecording,
          }}
        />
      </View>

      <QuickNameModal
        visible={screen.quickNameModalVisible}
        draftValue={screen.quickNameDraft}
        placeholderValue={screen.recordingPlaceholderTitle}
        onChangeDraft={screen.setQuickNameDraft}
        isPrimary={screen.isPrimaryDraft}
        onChangeIsPrimary={screen.recordingIdea?.kind === "project" ? screen.setIsPrimaryDraft : undefined}
        onCancel={screen.handleQuickNameCancel}
        onSave={async () => {
          const saved = await screen.saveQuickClipName();
          if (!saved) {
            return;
          }
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          navigation.navigate("Home" as never);
        }}
      />

      <RecordingSettingsModal
        visible={screen.settingsVisible}
        disabled={screen.recordingControlsDisabled}
        preferredInputId={screen.preferredRecordingInputId}
        onClose={() => screen.setSettingsVisible(false)}
        onChangePreferredInputId={screen.setPreferredRecordingInputId}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

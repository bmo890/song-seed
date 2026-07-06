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
import { RecordingMetronomeSheet } from "./RecordingMetronomeSheet";
import { RecordingTimingWarnings } from "./RecordingTimingWarnings";
import { SaveDestinationPickerSheet } from "../modals/SaveDestinationPickerSheet";
import { METRONOME_METER_PRESETS } from "../../metronome";
import { useRecordingScreenModel } from "./hooks/useRecordingScreenModel";

export function RecordingScreen() {
  const navigation = useNavigation();
  const screen = useRecordingScreenModel();
  const meterLabel =
    METRONOME_METER_PRESETS.find((p) => p.id === screen.metronome.meterId)?.label ?? "";
  const metronomeSummary = `${screen.metronome.bpm} · ${meterLabel}${
    screen.metronome.countInBars > 0 ? ` · count ${screen.metronome.countInBars}` : ""
  }`;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.recordingScreenLayout}>
        <RecordingHeader
          eyebrow={screen.headerEyebrow}
          title={screen.recordingIdea?.title || "Recording"}
          titleIsPlaceholder={screen.headerTitlePlaceholder}
          controlsDisabled={screen.recordingControlsDisabled}
          collapsed={screen.lyricsExpanded}
          onBack={screen.confirmDiscardAndExit}
          onMinimize={screen.minimizeRecording}
          onOpenSettings={() => screen.setSettingsVisible(true)}
        />

        <RecordingTimingWarnings
          warnings={screen.timingWarnings}
          onCalibrate={screen.openBluetoothCalibration}
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
          guideJoin={screen.guideJoinInfo}
          waveformData={screen.recording.liveWaveformData ?? screen.recording.analysisData}
          metronomeEnabled={screen.recordingMetronomeEnabled}
          metronomeSummary={metronomeSummary}
          metronomeToggleDisabled={
            screen.recordingControlsDisabled || !screen.metronome.isNativeAvailable
          }
          onToggleMetronome={() =>
            screen.setMetronomeEnabledForTake(!screen.recordingMetronomeEnabled)
          }
          onOpenMetronome={() => screen.setMetronomeSheetVisible(true)}
          onToggleLyricsExpanded={screen.setLyricsExpanded}
          onToggleLyricsAutoscroll={(enabled) =>
            screen.setLyricsAutoscrollMode(enabled ? "follow" : "off")
          }
          onLyricsAutoscrollInterrupted={() => screen.setLyricsAutoscrollMode("manual")}
          onSelectLyricsAutoscrollSpeedMultiplier={screen.setLyricsAutoscrollSpeedMultiplier}
          onOpenBluetoothCalibration={() => navigation.navigate("BluetoothCalibration" as never)}
        />

        <RecordingBottomDock
          compact={screen.lyricsExpanded}
          metronome={{
            beatToken: screen.metronome.beatCount,
            beatInBar: screen.metronome.currentBeatInBar,
            isCountIn: screen.metronome.isCountIn,
            isRunning: screen.metronome.isRunning,
          }}
          recording={{
            isRecording: screen.recording.isRecording,
            isPaused: screen.recording.isPaused,
            isArming: screen.isArmingRecording,
            isReviewLocked: screen.overdubReviewLocked,
            onPause: screen.handlePauseRecording,
            onResume: screen.handleResumeRecording,
            onStart: screen.handleStartRecording,
            onRequestSave: screen.requestSaveRecording,
            onDiscard: screen.confirmDiscardAndExit,
            onRedo: screen.confirmRedoTake,
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
        destinationWorkspaceTitle={
          screen.canPickSaveDestination ? screen.effectiveDestinationWorkspaceTitle : undefined
        }
        destinationCollectionLabel={
          screen.canPickSaveDestination ? screen.effectiveDestinationCollectionLabel : undefined
        }
        onPressDestination={
          screen.canPickSaveDestination ? () => screen.setSaveDestinationPickerVisible(true) : undefined
        }
      />

      <SaveDestinationPickerSheet
        visible={screen.saveDestinationPickerVisible}
        destinations={screen.saveDestinations}
        selectedCollectionId={
          screen.saveDestinationOverride?.collectionId ?? screen.recordingIdea?.collectionId ?? null
        }
        onClose={() => screen.setSaveDestinationPickerVisible(false)}
        onSelect={screen.handleSelectSaveDestination}
      />

      <RecordingSettingsModal
        visible={screen.settingsVisible}
        disabled={screen.recordingControlsDisabled}
        preferredInputId={screen.preferredRecordingInputId}
        outputLabel={screen.monitoringOutputLabel}
        isBluetoothOutput={screen.isBluetoothMonitoringOutput}
        onClose={() => screen.setSettingsVisible(false)}
        onChangePreferredInputId={screen.setPreferredRecordingInputId}
      />

      <RecordingMetronomeSheet
        visible={screen.metronomeSheetVisible}
        onClose={() => screen.setMetronomeSheetVisible(false)}
        disabled={screen.recordingControlsDisabled}
        isNativeAvailable={screen.metronome.isNativeAvailable}
        enabled={screen.recordingMetronomeEnabled}
        previewPlaying={
          screen.metronome.isRunning &&
          !screen.metronome.isCountIn &&
          !screen.recording.isRecording &&
          !screen.recording.isPaused
        }
        onTogglePreview={screen.toggleMetronomeSound}
        bpm={screen.metronome.bpm}
        meterId={screen.metronome.meterId}
        countInBars={screen.metronome.countInBars}
        outputs={screen.metronome.outputs}
        beepLevel={screen.metronome.beepLevel}
        hapticLevel={screen.metronome.hapticLevel}
        tapCount={screen.metronome.tapCount}
        restoredGridLabel={screen.restoredGridLabel}
        onNudgeBpm={screen.metronome.nudgeBpm}
        onSetBpmValue={screen.metronome.setBpmValue}
        onTapTempo={screen.metronome.tapTempo}
        onSelectMeter={screen.metronome.setMeterIdValue}
        onSelectCountInBars={screen.metronome.setCountInBarsValue}
        onToggleOutput={screen.metronome.toggleOutput}
        onChangeBeepLevel={screen.metronome.setBeepLevelValue}
        onChangeHapticLevel={screen.metronome.setHapticLevelValue}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

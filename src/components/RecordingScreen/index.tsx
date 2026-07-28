import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { QuickNameModal } from "../modals/QuickNameModal";
import { RecordingHeader } from "./components/RecordingHeader";
import { RecordingBody } from "./components/RecordingBody";
import { RecordingBeatBreath } from "./components/RecordingBeatBreath";
import { RecordingBottomDock } from "./components/RecordingBottomDock";
import { RecordingSettingsModal } from "./components/RecordingSettingsModal";
import { RecordingMetronomeSheet } from "./components/RecordingMetronomeSheet";
import { RecordingTimingWarnings } from "./components/RecordingTimingWarnings";
import { SaveDestinationPickerSheet } from "../modals/SaveDestinationPickerSheet";
import { METRONOME_METER_PRESETS } from "../../domain/metronome";
import { useStore } from "../../state/useStore";
import { useRecordingScreenModel } from "./hooks/useRecordingScreenModel";
import { HelpSheet } from "../common/HelpSheet";
import { RECORDING_HELP } from "../common/helpContent";
import { useTranslation } from "react-i18next";

export function RecordingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const screen = useRecordingScreenModel();
  const promptForClipName = useStore((state) => state.promptForClipName);
  // Finalizing a take (audio flush + waveform + persist) takes a real beat; drive the
  // Save button's spinner/locked state so the tap has feedback and can't fire twice.
  const [isSavingClip, setIsSavingClip] = React.useState(false);
  // Set if an auto-name save fails: falls back to showing the modal so the take is never
  // stranded on a hidden dialog. Cleared when a fresh naming session opens.
  const [autoNameFailed, setAutoNameFailed] = React.useState(false);
  const [helpVisible, setHelpVisible] = React.useState(false);
  const autoSaveTriedRef = React.useRef(false);

  // Persist the take, then leave the recording screen back to where it came from.
  // Shared by the naming modal's Save and the auto-name path below. Returns whether it saved.
  const finishSave = React.useCallback(async () => {
    if (isSavingClip) return false;
    setIsSavingClip(true);
    try {
      const saved = await screen.saveQuickClipName();
      if (!saved) return false;
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("Home" as never);
      }
      return true;
    } finally {
      setIsSavingClip(false);
    }
  }, [isSavingClip, navigation, screen]);

  // "Name each recording" off: skip the naming modal and save under the suggested title.
  // Overdubs always keep the modal (it doubles as their take review). The modal becoming
  // visible means the save target is committed, so saveQuickClipName runs with fresh state
  // and picks up the suggested name from an empty draft. Fires once per session; a failure
  // reveals the modal instead of retrying blindly.
  const isOverdubSession = !!screen.recordingOverdubClip;
  const autoNameActive =
    screen.quickNameModalVisible && !promptForClipName && !isOverdubSession && !autoNameFailed;
  React.useEffect(() => {
    if (!screen.quickNameModalVisible) {
      autoSaveTriedRef.current = false;
      if (autoNameFailed) setAutoNameFailed(false);
      return;
    }
    if (autoNameActive && !isSavingClip && !autoSaveTriedRef.current) {
      autoSaveTriedRef.current = true;
      void finishSave().then((saved) => {
        if (!saved) setAutoNameFailed(true);
      });
    }
  }, [screen.quickNameModalVisible, autoNameActive, isSavingClip, finishSave, autoNameFailed]);
  const meterLabel =
    METRONOME_METER_PRESETS.find((p) => p.id === screen.metronome.meterId)?.label ?? "";
  const metronomeSummary = `${screen.metronome.bpm} · ${meterLabel}${
    screen.metronome.countInBars > 0 ? ` · ${t("recording.countSummary", { count: screen.metronome.countInBars })}` : ""
  }`;

  return (
    // The room changes colour, not shape: a live take washes the page to
    // recordSurface. Nothing moves, nothing resizes — the state is felt.
    <SafeAreaView
      style={[styles.screen, screen.recording.isRecording ? styles.recordingScreenLive : null]}
    >
      <View style={styles.recordingScreenLayout}>
        <RecordingHeader
          eyebrow={screen.headerEyebrow}
          eyebrowShort={screen.headerEyebrowShort}
          // A new version names the take it grows from, not just the sketch.
          title={
            screen.recordingParentClip?.title ||
            screen.recordingIdea?.title ||
            t("recording.title")
          }
          titleIsPlaceholder={screen.headerTitlePlaceholder}
          controlsDisabled={screen.recordingControlsDisabled}
          collapsed={screen.lyricsExpanded}
          onBack={screen.confirmDiscardAndExit}
          onMinimize={screen.minimizeRecording}
          onOpenSettings={() => screen.setSettingsVisible(true)}
          onHelp={() => setHelpVisible(true)}
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
            pulsesPerBar: screen.metronome.meterPreset.pulsesPerBar,
            accentPattern: screen.metronome.accentPattern,
            grouping: screen.metronome.grouping,
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
        visible={screen.quickNameModalVisible && !autoNameActive}
        // Inside a sketch the object is a take; elsewhere it stays a clip.
        title={screen.recordingIdea?.kind === "project" ? t("modals.saveTakeAs") : undefined}
        primaryLabel={screen.recordingIdea?.kind === "project" ? t("modals.makePrimaryTake") : undefined}
        draftValue={screen.quickNameDraft}
        placeholderValue={screen.recordingPlaceholderTitle}
        onChangeDraft={screen.setQuickNameDraft}
        isPrimary={screen.isPrimaryDraft}
        onChangeIsPrimary={screen.recordingIdea?.kind === "project" ? screen.setIsPrimaryDraft : undefined}
        onCancel={screen.handleQuickNameCancel}
        saving={isSavingClip}
        onSave={finishSave}
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
        onToggleEnabled={(next) => screen.setMetronomeEnabledForTake(next)}
        meterId={screen.metronome.meterId}
        grouping={screen.metronome.grouping}
        onSelectGrouping={screen.metronome.setGrouping}
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

      {/* Sits above everything and eats no touches: the beat belongs to the room,
          not to a control. */}
      <RecordingBeatBreath
        beatToken={screen.metronome.beatCount}
        beatInBar={screen.metronome.currentBeatInBar}
        accentPattern={screen.metronome.accentPattern}
        active={
          (screen.metronome.isRunning || screen.metronome.isCountIn) &&
          screen.metronome.outputs.visual
        }
      />

      <HelpSheet
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title={RECORDING_HELP.title}
        intro={RECORDING_HELP.intro}
        items={RECORDING_HELP.items}
      />
    </SafeAreaView>
  );
}

import { useNavigation } from "@react-navigation/native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { audioDeviceManager, type AudioDevice } from "@siteed/audio-studio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { toast } from "../../common/toastStore";
import {
  buildBluetoothMonitoringRouteKey,
  getBluetoothMonitoringCalibrationForRoute,
  isBluetoothLikeAudioDevice,
} from "../../../domain/bluetoothMonitoring";
import { getClipPlaybackDurationMs, getClipPlaybackWaveformPeaks } from "../../../domain/clipPresentation";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../domain/lyrics";
import { useRecording } from "../../../hooks/useRecording";
import { useMetronome } from "../../../hooks/useMetronome";
import {
  formatLatencyProfileLog,
  resolveCurrentRouteLatencyProfile,
} from "../../../services/latencyModel";
import SongNookMetronomeModule from "../../../../modules/songnook-metronome";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";
import type { ClipVersion, RecordingGrid } from "../../../types";
import { getDefaultOverdubStemTitle, getRecordingGridBarMs } from "../../../domain/overdub";
import {
  getMetronomeAccentPattern,
  getMetronomeMeterPreset,
  isSameGrouping,
} from "../../../domain/metronome";
import {
  barStartMs,
  gridTempoMap,
  normalizeTempoMap,
  TEMPO_MAP_SCHEMA_VERSION,
  type TempoMap,
} from "../../../domain/tempoMap";
import { nativeTempoMapSegments } from "../../../domain/playbackClick";
import { describeGridPosition, resolveResumeClickPhase } from "../../../domain/resumeClickPhase";
import { buildSaveDestinations, resolveSaveDestinationLabel, type SaveDestination } from "../../../domain/collectionManagement";
import { personalWorkspaces } from "../../../domain/workspaceVisibility";
import { authorizeIntentionalEmptyStateWrite } from "../../../services/stateIntegrity";
import { selfAlignClipGrid } from "../../../services/gridSelfAlignment";
import { ensureWaveformSidecar } from "../../../services/waveformSidecar";
import { maybeRequestReviewAfterSave } from "../../../services/reviewPrompt";
import {
  buildDefaultIdeaTitle,
  ensureUniqueCountedTitle,
  fmtDuration,
  genChildClipTitle,
  genRootClipTitle,
  isDefaultIdeaTitle,
} from "../../../utils";
import { useTranslation } from "react-i18next";

/** Trim slightly early rather than late: the capture-start estimate is biased late by
 *  bridge delivery latency (~10-20 ms), and cutting into the downbeat transient is worse
 *  than keeping a few ms of pre-roll. */
const HEAD_TRIM_SAFETY_EARLY_MS = 15;
/** Fallback lead for the guide's play() when its start latency couldn't be measured.
 *  The primary path measures the real latency with a muted warm-start instead. */
const GUIDE_DOWNBEAT_LEAD_MS = 80;
/** BT latency drifts with codec renegotiation and firmware — nudge a re-check when the
 *  ear calibration is older than this. */
const CALIBRATION_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// Guide-player resume latency measured by the most recent phase-locked start (a device
// property, stable within an app session — logs show ~35–70 ms). Cached at module level
// so a take WITHOUT a count-in can schedule a locked guide start with a much shorter
// lead: the rehearsal that measures this needs time the count-in normally donates.
let sessionGuideResumeLatencyMs: number | null = null;

/** Lead time a phase-locked guide start needs from "now": one muted warm cycle always
 *  runs (cold-start the player, measure, rewind); the second cycle that measures resume
 *  latency is skipped when a cached measurement exists. */
function guideLockLeadNeededMs() {
  return sessionGuideResumeLatencyMs != null ? 1200 : 1800;
}

export type RecordingTimingWarning = {
  kind: "uncalibrated-bt" | "stale-calibration" | "bt-mic" | "route-changed";
  message: string;
  showCalibrateAction: boolean;
};

export function useRecordingScreenModel() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const recordingIdeaId = useStore((s) => s.recordingIdeaId);
  const recordingParentClipId = useStore((s) => s.recordingParentClipId);
  const recordingOverdubClipId = useStore((s) => s.recordingOverdubClipId);
  const recordingGuideMixUri = useStore((s) => s.recordingGuideMixUri);
  const recordingPunchInMs = useStore((s) => s.recordingPunchInMs);
  const recordingSaveRequestToken = useStore((s) => s.recordingSaveRequestToken);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const quickNameModalVisible = useStore((s) => s.quickNameModalVisible);
  const quickNameDraft = useStore((s) => s.quickNameDraft);
  const quickNamingIdeaId = useStore((s) => s.quickNamingIdeaId);
  const setQuickNameModalVisible = useStore((s) => s.setQuickNameModalVisible);
  const setQuickNameDraft = useStore((s) => s.setQuickNameDraft);
  const setQuickNamingIdeaId = useStore((s) => s.setQuickNamingIdeaId);
  const preferredRecordingInputId = useStore((s) => s.preferredRecordingInputId);
  const bluetoothMonitoringCalibrations = useStore((s) => s.bluetoothMonitoringCalibrations);
  const setPreferredRecordingInputId = useStore((s) => s.setPreferredRecordingInputId);
  const updateIdeas = useStore((s) => s.updateIdeas);
  const clearRecordingContext = useStore((s) => s.clearRecordingContext);

  const recordingIdea = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId)?.ideas.find((i) => i.id === recordingIdeaId),
    [workspaces, activeWorkspaceId, recordingIdeaId]
  );
  const recordingOverdubClip = useMemo(
    () =>
      recordingOverdubClipId && recordingIdea
        ? recordingIdea.clips.find((clip) => clip.id === recordingOverdubClipId) ?? null
        : null,
    [recordingIdea, recordingOverdubClipId]
  );

  // ── Punch-in (spot layers) ────────────────────────────────────────────────
  // The punch point (bar-snapped at arm time; store holds the snapped value) is where
  // the saved stem sits on the master's timeline. Lead-in policy: WITH a count-in the
  // clicks are the lead-in and the master enters exactly at the punch on the downbeat;
  // WITHOUT one, the guide monitors from one bar earlier so the performer hears the
  // previous bar of the actual song as a grid-true lead-in (fixed fallback when the
  // master has no tempo grid). 0 = classic full-length layer — every code path below
  // reduces to the pre-punch behavior exactly.
  const punchInMs = recordingGuideMixUri ? recordingPunchInMs ?? 0 : 0;
  // Without a grid the lead-in is SECONDS of the actual song — the point is to
  // hear where you are and where you're punching in, and 1.5s wasn't a run-up,
  // it was a stumble. With a grid, one bar stays the musical lead-in.
  const punchLeadInMs =
    punchInMs > 0
      ? Math.min(punchInMs, getRecordingGridBarMs(recordingOverdubClip?.recordingGrid) ?? 3000)
      : 0;
  // Arriving via a take's "New version" action: the header names the take being
  // versioned, not just the sketch — the recorder finally says which path you took.
  const recordingParentClip = useMemo(
    () =>
      recordingParentClipId && recordingIdea
        ? recordingIdea.clips.find((clip) => clip.id === recordingParentClipId) ?? null
        : null,
    [recordingIdea, recordingParentClipId]
  );
  const headerTitlePlaceholder =
    !recordingOverdubClip &&
    !recordingParentClip &&
    !!recordingIdea &&
    isDefaultIdeaTitle(recordingIdea.title, recordingIdea.createdAt);
  const headerEyebrow = recordingOverdubClip
    ? punchInMs > 0
      ? t("recording.layerFrom", { time: fmtDuration(punchInMs) })
      : t("recording.layer")
    : recordingParentClip
      ? t("recording.newVersionOf")
      : recordingIdea
        ? headerTitlePlaceholder
          ? t("recording.newRecording")
          : t("recording.recordingInto")
        : null;
  // One word for the collapsed header, where the destination has to share the
  // nav row with the caret and the utility glyphs.
  const headerEyebrowShort = recordingOverdubClip
    ? t("recording.overShort")
    : recordingParentClip
      ? t("recording.versionShort")
      : recordingIdea
        ? t("recording.intoShort")
        : null;
  const latestLyricsVersion = recordingIdea?.kind === "project" ? getLatestLyricsVersion(recordingIdea) : null;
  const latestLyricsText = lyricsDocumentToText(latestLyricsVersion?.document);
  const hasProjectLyrics = recordingIdea?.kind === "project" && latestLyricsText.trim().length > 0;

  // A save-destination choice only makes sense for a fresh standalone take — overdubs and
  // project variations/children must attach to their existing parent idea/clip, so their
  // location is fixed.
  const canPickSaveDestination =
    !!recordingIdea && recordingIdea.kind === "clip" && !recordingOverdubClip && !recordingParentClipId;
  const saveDestinations = useMemo(
    // Creation surface: recordings may only target the user's OWN workspaces —
    // a received package must never be offered as a save destination.
    () => (canPickSaveDestination ? buildSaveDestinations(personalWorkspaces(workspaces), activeWorkspaceId) : []),
    [canPickSaveDestination, workspaces, activeWorkspaceId]
  );
  const defaultDestinationLabel = recordingIdea
    ? resolveSaveDestinationLabel(workspaces, activeWorkspaceId, recordingIdea.collectionId)
    : null;
  const guideMixSource = useMemo(
    () => (recordingGuideMixUri ? { uri: recordingGuideMixUri } : null),
    [recordingGuideMixUri]
  );
  const guideMixPlayer = useAudioPlayer(guideMixSource, { updateInterval: 250 });
  const guideMixStatus = useAudioPlayerStatus(guideMixPlayer);

  const [isPrimaryDraft, setIsPrimaryDraft] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [metronomeSheetVisible, setMetronomeSheetVisible] = useState(false);
  const [recordingMetronomeEnabled, setRecordingMetronomeEnabled] = useState(false);
  const [isArmingRecording, setIsArmingRecording] = useState(false);
  const [currentRecordingInput, setCurrentRecordingInput] = useState<AudioDevice | null>(null);
  const [currentMonitoringOutput, setCurrentMonitoringOutput] = useState<{
    name: string;
    type: string;
    profile?: string | null;
  } | null>(null);
  // Take position at which the audio route changed mid-take (null = it didn't). The grid
  // is only trustworthy up to that point — surfaced as a warning and stamped on the grid.
  const [midTakeRouteChangeMs, setMidTakeRouteChangeMs] = useState<number | null>(null);
  const [guideMonitoringLeadInMs, setGuideMonitoringLeadInMs] = useState(0);
  /** While a no-count-in overdub waits for the master to join at the next bar line,
   *  this drives the on-screen countdown — the "implicit count-in" was invisible and
   *  read as a ghost bar imposed on the take. Null when no join is pending. */
  const [guideJoinInfo, setGuideJoinInfo] = useState<{ joinAtEpochMs: number; beatMs: number } | null>(null);
  const [overdubReviewLocked, setOverdubReviewLocked] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [lyricsAutoscrollMode, setLyricsAutoscrollMode] = useState<"off" | "follow" | "manual">("off");
  const [lyricsAutoscrollSpeedMultiplier, setLyricsAutoscrollSpeedMultiplier] = useState(1);
  const [saveDestinationOverride, setSaveDestinationOverride] = useState<SaveDestination | null>(null);
  const [saveDestinationPickerVisible, setSaveDestinationPickerVisible] = useState(false);

  const effectiveDestinationWorkspaceTitle =
    saveDestinationOverride?.workspaceTitle ?? defaultDestinationLabel?.workspaceTitle ?? undefined;
  const effectiveDestinationCollectionLabel =
    saveDestinationOverride?.pathLabel ??
    saveDestinationOverride?.label ??
    defaultDestinationLabel?.collectionLabel ??
    undefined;

  const handledSaveRequestRef = useRef<number | null>(null);
  // Beat grid the in-flight take is being recorded against, snapshotted when the take
  // starts (the global metronome settings can change afterwards). Attached to the saved
  // clip/stem as `recordingGrid`; null when the take doesn't use the metronome at all.
  const takeGridRef = useRef<RecordingGrid | null>(null);
  /** The measured beat grid of the RUNNING take, in capture-file ms — drives the live
   *  tape's beat ruler so the lines the performer records against are the same lines
   *  playback will draw. Null when no metronome is in the take or nothing is measured. */
  const [liveTakeGrid, setLiveTakeGrid] = useState<{
    firstBeatCaptureMs: number;
    beatMs: number;
    pulsesPerBar: number;
    /** Programmed tempo/meter changes. Without it the live ruler drew the FIRST segment's
     *  spacing for the whole take, so from the first change onward it was measuring the
     *  performance against a beat length the click had stopped playing. */
    tempoMap?: TempoMap | null;
  } | null>(null);
  /** Mirror for imperative readers (the resume handler) — a press handler must not depend
   *  on having re-rendered since the grid was measured. */
  const liveTakeGridRef = useRef(liveTakeGrid);
  liveTakeGridRef.current = liveTakeGrid;  const takeGridChangeTimersRef = useRef<
    { handle: ReturnType<typeof setTimeout>; gridMs: number }[]
  >([]);
  /** True while the running take's changes are scheduled by the native map engine. */
  const takeUsesNativeMapRef = useRef(false);
  const countInPendingRef = useRef(false);
  const countInModeRef = useRef<"start" | "resume">("start");
  const initializedMetronomeRef = useRef(false);
  const pendingOverdubSaveRef = useRef<{ ideaId: string; clipId: string; title: string } | null>(null);
  const autoStoppingOverdubRef = useRef(false);
  const abandonedPlaceholderCleanupRef = useRef<() => void>(() => {});
  const metronome = useMetronome();
  const monitoringDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Phase-locked guide start scheduled during the count-in (overdubs). The token
  // invalidates an in-flight schedule when the guide is stopped/cancelled; the promise
  // resolves with the guide's measured start epoch for the head-trim math.
  const guideScheduleRef = useRef<{ token: number; promise: Promise<number | null> | null }>({
    token: 0,
    promise: null,
  });

  const recording = useRecording(
    async (payload) => {
      // A trimmed head means the file now starts at the musical start (downbeat for solo
      // takes, guide t=0 for overdubs) — record that certainty in the grid metadata.
      //
      // Not at zero, though: the cut is deliberately placed HEAD_TRIM_SAFETY_EARLY_MS
      // before the musical start so a rounding error can never clip the first transient.
      // Stamping 0 threw that margin away and told everything downstream a lie the size of
      // the margin — small, but permanent, in the same direction every take, and inherited
      // by every overdub and every export. The file starts early; say so.
      const takeGrid = takeGridRef.current
        ? {
            ...takeGridRef.current,
            firstDownbeatMs:
              payload.headTrimmedMs != null && payload.headTrimmedMs > 0
                ? HEAD_TRIM_SAFETY_EARLY_MS
                : takeGridRef.current.firstDownbeatMs,
          }
        : undefined;

      // Warm the detail-waveform sidecar in the background NOW, while the user is still
      // on the save sheet — otherwise the first full-player open of this clip decodes
      // the whole file on the spot, which is the visible "reel takes a moment to load".
      void ensureWaveformSidecar(payload.audioUri, payload.durationMs).catch(() => {});

      const pendingOverdubSave = pendingOverdubSaveRef.current;
      if (pendingOverdubSave) {
        // A punch take's file t=0 IS the punch point (head-trimmed to the guide's
        // measured punch epoch), so the stem sits on the master at that offset.
        const punchOffsetMs = useStore.getState().recordingPunchInMs ?? 0;
        await appActions.attachRecordedOverdubStem(
          pendingOverdubSave.ideaId,
          pendingOverdubSave.clipId,
          { ...payload, recordingGrid: takeGrid, offsetMs: punchOffsetMs },
          pendingOverdubSave.title
        );
        return;
      }

      const state = useStore.getState();
      const currentWorkspaceId = state.activeWorkspaceId;
      const targetIdea =
        recordingIdeaId && currentWorkspaceId
          ? state.workspaces
              .find((workspace) => workspace.id === currentWorkspaceId)
              ?.ideas.find((idea) => idea.id === recordingIdeaId) ?? null
          : null;
      // Signal non-attachment so saveRecording preserves the take for recovery instead of
      // clearing the session and silently orphaning the audio.
      if (!recordingIdeaId || !targetIdea) return false;

      const parentClip = recordingParentClipId
        ? targetIdea.clips.find((clip) => clip.id === recordingParentClipId) ?? null
        : null;

      const title = parentClip
        ? genChildClipTitle(targetIdea.clips, parentClip)
        : genRootClipTitle(targetIdea.clips);

      // Stamp the lyrics version the singer had in front of them — the take's
      // page. The reader honors this stamp; editing the lyrics later can never
      // rewrite what this take shows.
      const lyricsVersionAtRecord =
        targetIdea.kind === "project" ? getLatestLyricsVersion(targetIdea)?.id : undefined;

      const clip: ClipVersion = {
        id: `clip-${Date.now()}`,
        title,
        isTitleAutoGenerated: true,
        notes: "",
        createdAt: Date.now(),
        isPrimary: targetIdea.kind === "project" ? isPrimaryDraft : true,
        parentClipId: recordingParentClipId ?? undefined,
        audioUri: payload.audioUri,
        durationMs: payload.durationMs,
        waveformPeaks: payload.waveformPeaks,
        recordingGrid: takeGrid,
        lyricsVersionId: lyricsVersionAtRecord,
        tags: parentClip?.tags?.length ? [...parentClip.tags] : undefined,
      };

      updateIdeas((ideas) =>
        ideas.map((idea) => {
          if (idea.id !== recordingIdeaId) return idea;

          const nextClips = idea.clips.map((existingClip) =>
            isPrimaryDraft ? { ...existingClip, isPrimary: false } : existingClip
          );

          return { ...idea, clips: [clip, ...nextClips] };
        })
      );

      // The stamped grid is built from SCHEDULED click epochs; align it to the clicks the
      // mic actually recorded (device latency, or a failed record-time measurement).
      if (takeGrid?.clickThroughTake) {
        void selfAlignClipGrid({
          ideaId: recordingIdeaId,
          clipId: clip.id,
          audioUri: payload.audioUri,
          durationMs: payload.durationMs ?? clip.durationMs ?? 0,
          grid: takeGrid,
          onsetEnvelope: payload.onsetEnvelope,
        });
      }
    },
    preferredRecordingInputId
  );

  const recordingControlsDisabled = isArmingRecording || (recording.isRecording && !recording.isPaused);
  /**
   * The metronome is fixed for the duration of a take — including while PAUSED.
   *
   * Everything downstream of a take's grid assumes one set of click settings anchored at one
   * downbeat: the head trim, the live ruler, the saved grid, self-alignment. Letting the
   * meter or tempo change mid-take would mean the grid stamped at the downbeat stops
   * describing the audio from the change onward, with nothing anchoring the later segments.
   * Supporting that properly is a bigger piece of work than it looks; until then the honest
   * thing is to make it impossible rather than to let it half-work.
   */
  /** Preview ruler for an armed-but-not-yet-recording metronome. Single-tempo by design:
   *  before the downbeat, bar 1's spacing is the only honest thing to show. */
  const previewTakeGrid = useMemo(() => {
    if (!recordingMetronomeEnabled || !metronome.isNativeAvailable) return null;
    if (!(metronome.beatIntervalMs > 0)) return null;
    return {
      firstBeatCaptureMs: 0,
      beatMs: metronome.beatIntervalMs,
      pulsesPerBar: metronome.meterPreset.pulsesPerBar,
      tempoMap: null,
    };
  }, [
    metronome.beatIntervalMs,
    metronome.isNativeAvailable,
    metronome.meterPreset.pulsesPerBar,
    recordingMetronomeEnabled,
  ]);

  const metronomeLockedForTake =
    isArmingRecording || recording.isRecording || recording.isPaused;
  const guideMixDurationMs =
    Math.round((guideMixStatus.duration ?? 0) * 1000) ||
    (recordingOverdubClip ? getClipPlaybackDurationMs(recordingOverdubClip) ?? 0 : 0);
  const rawGuideMixPositionMs = Math.round((guideMixStatus.currentTime ?? 0) * 1000);
  const guideMixPositionMs = Math.max(0, rawGuideMixPositionMs - guideMonitoringLeadInMs);
  const guideMixWaveformPeaks = recordingOverdubClip
    ? getClipPlaybackWaveformPeaks(recordingOverdubClip)
    : undefined;
  const isBluetoothRecordingInput = useMemo(() => isBluetoothLikeAudioDevice(currentRecordingInput), [currentRecordingInput]);
  const isBluetoothMonitoringOutput = useMemo(
    () => isBluetoothLikeAudioDevice(currentMonitoringOutput),
    [currentMonitoringOutput]
  );
  const bluetoothRouteKey = useMemo(
    () => buildBluetoothMonitoringRouteKey(currentMonitoringOutput),
    [currentMonitoringOutput]
  );
  const activeBluetoothCalibration = useMemo(
    () =>
      getBluetoothMonitoringCalibrationForRoute(
        bluetoothMonitoringCalibrations,
        isBluetoothMonitoringOutput ? bluetoothRouteKey : null
      ),
    [bluetoothMonitoringCalibrations, bluetoothRouteKey, isBluetoothMonitoringOutput]
  );
  const activeBluetoothCalibrationMs = activeBluetoothCalibration?.offsetMs ?? null;
  const monitoringCompensationMs =
    isBluetoothMonitoringOutput && activeBluetoothCalibrationMs != null ? activeBluetoothCalibrationMs : 0;
  const activeMonitoringCompensationMs =
    monitoringCompensationMs > 0 &&
    (Boolean(recordingGuideMixUri) || (recordingMetronomeEnabled && metronome.isNativeAvailable))
      ? monitoringCompensationMs
      : 0;

  const recordingInputLabel = currentRecordingInput?.name?.trim() || null;
  const monitoringOutputLabel = currentMonitoringOutput?.name?.trim() || null;

  // A swiped-away warning stays away for this recorder session — the condition it named
  // usually can't change without leaving the screen, so re-nagging is pure noise. A NEW
  // kind (e.g. a mid-take route change) still appears.
  const [dismissedWarningKinds, setDismissedWarningKinds] = useState<
    RecordingTimingWarning["kind"][]
  >([]);
  const dismissTimingWarning = useCallback((kind: RecordingTimingWarning["kind"]) => {
    setDismissedWarningKinds((current) =>
      current.includes(kind) ? current : [...current, kind]
    );
  }, []);

  // Honesty layer: surface every situation where timing can't be trusted BEFORE the user
  // wastes a take on it, with a one-tap path to fix what's fixable.
  const timingWarnings = useMemo<RecordingTimingWarning[]>(() => {
    const warnings: RecordingTimingWarning[] = [];
    const outputName = monitoringOutputLabel ?? t("recording.theseHeadphones");

    if (isBluetoothMonitoringOutput) {
      if (!activeBluetoothCalibration) {
        warnings.push({
          kind: "uncalibrated-bt",
          message: t("recording.uncalibrated", { name: outputName }),
          showCalibrateAction: true,
        });
      } else if (Date.now() - activeBluetoothCalibration.updatedAt > CALIBRATION_STALE_AFTER_MS) {
        warnings.push({
          kind: "stale-calibration",
          message: t("recording.staleCalibration", { name: outputName }),
          showCalibrateAction: true,
        });
      }
    }

    if (isBluetoothRecordingInput) {
      warnings.push({
        kind: "bt-mic",
        message: t("recording.bluetoothMicWarning"),
        showCalibrateAction: false,
      });
    }

    if (midTakeRouteChangeMs != null) {
      warnings.push({
        kind: "route-changed",
        message: t("recording.routeChanged", { seconds: Math.round(midTakeRouteChangeMs / 1000) }),
        showCalibrateAction: false,
      });
    }

    return warnings.filter((warning) => !dismissedWarningKinds.includes(warning.kind));
  }, [
    activeBluetoothCalibration,
    dismissedWarningKinds,
    isBluetoothMonitoringOutput,
    isBluetoothRecordingInput,
    midTakeRouteChangeMs,
    monitoringOutputLabel,
    t,
  ]);

  function openBluetoothCalibration() {
    // Calibration claims the audio session exclusively (mic released, so the headset
    // can leave the phone-call profile) — entering it mid-take would cut the recorder's
    // input. The banner stays visible while recording, so answer the tap honestly.
    if (recording.isRecording || recording.isPaused) {
      toast(t("recording.finishTakeFirst"), "timer-outline");
      return;
    }
    navigation.navigate("BluetoothCalibration" as never);
  }

  const fallbackClipTitle = () => buildDefaultIdeaTitle();

  const recordingPlaceholderTitle =
    recordingOverdubClip
      ? getDefaultOverdubStemTitle(recordingOverdubClip)
      : recordingIdea
      ? recordingIdea.kind === "project"
        ? (() => {
            const parentClip = recordingParentClipId
              ? recordingIdea.clips.find((c) => c.id === recordingParentClipId) ?? null
              : null;
            const suggested = parentClip
              ? genChildClipTitle(recordingIdea.clips, parentClip)
              : genRootClipTitle(recordingIdea.clips);
            return ensureUniqueCountedTitle(suggested, recordingIdea.clips.map((c) => c.title));
          })()
        : ensureUniqueCountedTitle(
            recordingIdea.title || fallbackClipTitle(),
            (workspaces.find((w) => w.id === activeWorkspaceId)?.ideas ?? [])
              .filter((idea) => idea.kind === "clip" && idea.id !== recordingIdea.id)
              .map((idea) => idea.title)
          )
      : fallbackClipTitle();

  function clearMonitoringDelayTimer() {
    if (monitoringDelayTimeoutRef.current) {
      clearTimeout(monitoringDelayTimeoutRef.current);
      monitoringDelayTimeoutRef.current = null;
    }
  }

  async function waitForMonitoringCompensation(delayMs: number) {
    if (delayMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      monitoringDelayTimeoutRef.current = setTimeout(() => {
        monitoringDelayTimeoutRef.current = null;
        resolve();
      }, delayMs);
    });
  }

  async function waitForGuideMixPlaybackStart() {
    if (!recordingGuideMixUri) {
      return;
    }

    const activationDeadline = Date.now() + 1200;

    while (Date.now() < activationDeadline) {
      if (guideMixPlayer.playing && !guideMixPlayer.isBuffering) {
        return;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 16);
      });
    }
  }

  async function stopGuideMix() {
    guideScheduleRef.current.token += 1;
    guideScheduleRef.current.promise = null;
    clearMonitoringDelayTimer();
    setGuideMonitoringLeadInMs(0);
    setGuideJoinInfo(null);
    if (!recordingGuideMixUri) return;
    try {
      guideMixPlayer.volume = 1;
      await guideMixPlayer.pause();
      await guideMixPlayer.seekTo(0);
    } catch (error) {
      // Screen teardown can release the player before this stop runs; that race is
      // harmless. Only surface real failures.
      const message = error instanceof Error ? error.message : String(error);
      if (!/released/i.test(message)) {
        console.warn("Guide mix stop failed", error);
      }
    }
  }

  async function waitPlainMs(ms: number) {
    if (ms <= 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /** Epoch time the guide's audio passed `basePositionMs`, anchored off its reported
   *  position. Base 0 = classic "when did playback start"; a punch take passes the seek
   *  position (the player idles AT the seek point, so only motion past it counts). */
  async function measureGuideAnchorEpochMs(
    timeoutMs: number,
    basePositionMs = 0
  ): Promise<number | null> {
    const baseSec = basePositionMs / 1000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const positionSec = guideMixPlayer.currentTime ?? 0;
      if (guideMixPlayer.playing && !guideMixPlayer.isBuffering && positionSec > baseSec + 0.005) {
        return Date.now() - (positionSec - baseSec) * 1000;
      }
      await waitPlainMs(16);
    }
    return null;
  }

  /**
   * Phase-lock the guide to the live metronome grid without any mid-flight seek (device
   * logs showed a corrective seek stalls playback 50–200 ms — worse than the error it
   * fixed). Instead, during the count-in: warm-start the guide MUTED to measure this
   * device's real play() latency, rewind, then fire the audible start pre-compensated by
   * the measured latency so the guide's recorded clicks land on the grid.
   *
   * `targetStartEpochMs` is when the guide's ANCHOR position should play. For a classic
   * take both positions are 0 (byte-identical to the pre-punch behavior); a punch take
   * seeks to `seekPositionMs` (punch minus the audible lead-in) and anchors trim math at
   * `anchorPositionMs` (the punch point itself). Resolves with the measured epoch of the
   * anchor position (what the head-trim math needs), or null on failure.
   */
  function schedulePhaseLockedGuideStart(
    targetStartEpochMs: number,
    opts?: { seekPositionMs?: number; anchorPositionMs?: number }
  ): Promise<number | null> {
    const seekPositionMs = Math.max(0, opts?.seekPositionMs ?? 0);
    const anchorLeadMs = Math.max(0, (opts?.anchorPositionMs ?? seekPositionMs) - seekPositionMs);
    const token = ++guideScheduleRef.current.token;
    const task = (async (): Promise<number | null> => {
      try {
        setGuideMonitoringLeadInMs(activeMonitoringCompensationMs);
        guideMixPlayer.volume = 0;
        await guideMixPlayer.seekTo(seekPositionMs / 1000);
        const coldPlayCallAtMs = Date.now();
        guideMixPlayer.play();
        const coldAnchorEpochMs = await measureGuideAnchorEpochMs(1200, seekPositionMs);
        if (guideScheduleRef.current.token !== token) return null;
        const coldStartLatencyMs =
          coldAnchorEpochMs != null
            ? Math.max(0, Math.min(600, coldAnchorEpochMs - coldPlayCallAtMs))
            : GUIDE_DOWNBEAT_LEAD_MS;
        await guideMixPlayer.pause();
        await guideMixPlayer.seekTo(seekPositionMs / 1000);
        if (guideScheduleRef.current.token !== token) return null;

        // The REAL start is a resume-from-pause, which is far faster than the cold start
        // (device logs: cold 233–518ms vs resume ~35–70ms — scheduling with the cold
        // number fired the guide up to half a second EARLY, before the count-in ended).
        // Resume latency jitters shot-to-shot, so a single muted measurement inherits
        // that jitter whole (device logs: a 157ms rehearsal against a ~136ms real start
        // = an audible 21ms flam). Take up to three muted cycles while the count-in
        // leaves time and use the median; when there's no time (no-count-in takes), a
        // measurement cached from any earlier take this session beats the capped cold
        // number.
        let startLatencyMs = sessionGuideResumeLatencyMs ?? Math.min(coldStartLatencyMs, 80);
        const audibleStartEpochMs = targetStartEpochMs - anchorLeadMs;
        const resumeSamplesMs: number[] = [];
        while (resumeSamplesMs.length < 3 && audibleStartEpochMs - Date.now() > 700) {
          const resumePlayCallAtMs = Date.now();
          guideMixPlayer.play();
          const resumeAnchorEpochMs = await measureGuideAnchorEpochMs(800, seekPositionMs);
          if (guideScheduleRef.current.token !== token) return null;
          const sampleOk = resumeAnchorEpochMs != null;
          if (sampleOk) {
            resumeSamplesMs.push(Math.max(0, Math.min(600, resumeAnchorEpochMs - resumePlayCallAtMs)));
          }
          await guideMixPlayer.pause();
          await guideMixPlayer.seekTo(seekPositionMs / 1000);
          if (guideScheduleRef.current.token !== token) return null;
          if (!sampleOk) break;
        }
        if (resumeSamplesMs.length > 0) {
          const sorted = [...resumeSamplesMs].sort((a, b) => a - b);
          startLatencyMs = sorted[Math.floor(sorted.length / 2)];
          sessionGuideResumeLatencyMs = startLatencyMs;
        }
        console.log(
          `[timing] guide start latency: cold=${Math.round(coldStartLatencyMs)}ms ` +
            `resume=${Math.round(startLatencyMs)}ms` +
            (resumeSamplesMs.length > 1
              ? ` (median of ${resumeSamplesMs.map((v) => Math.round(v)).join("/")})`
              : "")
        );

        await waitPlainMs(audibleStartEpochMs - startLatencyMs - Date.now());
        if (guideScheduleRef.current.token !== token) return null;
        guideMixPlayer.volume = 1;
        guideMixPlayer.play();
        const seekAnchorEpochMs = await measureGuideAnchorEpochMs(1500, seekPositionMs);
        if (guideScheduleRef.current.token !== token) return null;
        if (seekAnchorEpochMs == null) {
          return null;
        }
        // Project the measured start forward to the anchor position (= punch point; 0 for
        // a classic take, where this is the identity).
        const anchorEpochMs = seekAnchorEpochMs + anchorLeadMs;
        const phaseErrorMs = anchorEpochMs - targetStartEpochMs;
        // Close the loop: the miss IS the difference between the rehearsed latency and
        // the real one, so fold it into the session cache — the next take this session
        // schedules with the corrected number instead of repeating the same miss.
        const correctedLatencyMs = Math.max(0, Math.min(600, startLatencyMs + phaseErrorMs));
        sessionGuideResumeLatencyMs = correctedLatencyMs;
        console.log(
          `[timing] guide phase vs metronome grid: ${Math.round(phaseErrorMs)}ms ` +
            `(+ = guide late, next-take latency ${Math.round(correctedLatencyMs)}ms)`
        );
        return anchorEpochMs;
      } catch (error) {
        console.warn("Phase-locked guide start failed", error);
        // Restore volume ONLY if this schedule still owns the player — a stale failure
        // unmuting while a NEWER schedule runs its muted rehearsal would make that
        // rehearsal audible (a ghost blast of the master during the count-in).
        if (guideScheduleRef.current.token === token) {
          try {
            guideMixPlayer.volume = 1;
          } catch {
            // Player may already be released during teardown.
          }
        }
        return null;
      }
    })();
    guideScheduleRef.current.promise = task;
    return task;
  }

  /** Start the guide (from t=0, or from a punch take's seek position) and return the
   *  measured epoch of its ANCHOR position — playback start for a classic take, the
   *  punch point for a punch take (anchored off the player's reported position, same
   *  technique as the calibration baseline fix). Null when the anchor couldn't be
   *  established. */
  async function startGuideMixFromBeginningAnchored(opts?: {
    seekPositionMs?: number;
    anchorPositionMs?: number;
  }): Promise<number | null> {
    if (!recordingGuideMixUri) return null;
    const seekPositionMs = Math.max(0, opts?.seekPositionMs ?? 0);
    const anchorLeadMs = Math.max(0, (opts?.anchorPositionMs ?? seekPositionMs) - seekPositionMs);
    try {
      setGuideMonitoringLeadInMs(activeMonitoringCompensationMs);
      await guideMixPlayer.seekTo(seekPositionMs / 1000);
      guideMixPlayer.play();
      const seekAnchorEpochMs = await measureGuideAnchorEpochMs(1500, seekPositionMs);
      if (seekAnchorEpochMs != null) {
        return seekAnchorEpochMs + anchorLeadMs;
      }
    } catch (error) {
      console.warn("Guide mix anchored start failed", error);
    }
    return null;
  }

  async function resumeGuideMix() {
    if (!recordingGuideMixUri) return;
    try {
      setGuideMonitoringLeadInMs(activeMonitoringCompensationMs);
      guideMixPlayer.play();
      await waitForGuideMixPlaybackStart();
    } catch (error) {
      console.warn("Guide mix resume failed", error);
    }
  }

  async function pauseGuideMix() {
    guideScheduleRef.current.token += 1;
    guideScheduleRef.current.promise = null;
    clearMonitoringDelayTimer();
    if (!recordingGuideMixUri) return;
    try {
      await guideMixPlayer.pause();
    } catch (error) {
      console.warn("Guide mix pause failed", error);
    }
  }

  async function stopRecordingMetronome() {
    clearMonitoringDelayTimer();
    clearTakeGridChangeTimers();
    if (!metronome.isRunning && !metronome.isCountIn) {
      return;
    }

    try {
      await metronome.stop();
    } catch (error) {
      console.warn("Recording metronome stop failed", error);
    }
  }

  /**
   * Programmed tempo/meter changes during the take (pre-Phase-E): the engine can't
   * follow a map natively yet, so each segment boundary gets a JS-scheduled partial
   * configure() — a structural change restarts the engine with its phase at the bar
   * line, which is exactly the boundary's downbeat. Seam = JS-timer + restart
   * latency, once per change; the scheduled-click engine removes it entirely.
   */
  function clearTakeGridChangeTimers() {
    for (const timer of takeGridChangeTimersRef.current) {
      clearTimeout(timer.handle);
    }
    // Any change that never fired makes the stamped grid a lie past its bar line —
    // mark the grid honest-up-to-there. A boundary past the file's end is inert
    // (readers only honour gridValidToMs when it lands inside the audio).
    const earliestPending = takeGridChangeTimersRef.current[0];
    if (earliestPending && takeGridRef.current) {
      takeGridRef.current = {
        ...takeGridRef.current,
        gridValidToMs: Math.min(
          takeGridRef.current.gridValidToMs ?? Infinity,
          Math.max(0, Math.round(earliestPending.gridMs))
        ),
      };
    }
    takeGridChangeTimersRef.current = [];
  }

  function scheduleTakeGridChanges(downbeatEpochMs: number) {
    clearTakeGridChangeTimers();
    const grid = takeGridRef.current;
    const map = grid?.tempoMap;
    if (!grid || !map || map.segments.length < 2 || !grid.clickThroughTake) {
      return;
    }

    for (const segment of map.segments.slice(1)) {
      const gridMs = barStartMs(map, segment.atBar);
      const waitMs = downbeatEpochMs + gridMs - Date.now();
      if (waitMs <= 0) {
        continue;
      }
      const preset = getMetronomeMeterPreset(segment.meterId);
      const accentPattern =
        segment.meterId === grid.meterId
          ? getMetronomeAccentPattern(segment.meterId, grid.grouping ?? null)
          : getMetronomeAccentPattern(segment.meterId);
      const handle = setTimeout(() => {
        takeGridChangeTimersRef.current = takeGridChangeTimersRef.current.filter(
          (entry) => entry.handle !== handle
        );
        console.log(
          `[timing] take grid change: bar ${segment.atBar} → ${segment.bpm} · ${segment.meterId}`
        );
        // Partial configure: both engines keep absent keys (volume, cues, latency,
        // subdivision, click voice) from the running config, so only the structure
        // changes — the take keeps the voice it started with.
        void SongNookMetronomeModule?.configure({
          bpm: segment.bpm,
          meterId: segment.meterId,
          pulsesPerBar: preset.pulsesPerBar,
          denominator: preset.denominator,
          accentPattern,
          clickEnabled: true,
        }).catch((error) => {
          console.warn("[timing] take grid change failed — grid marked untrusted", error);
          if (takeGridRef.current) {
            takeGridRef.current = {
              ...takeGridRef.current,
              gridValidToMs: Math.min(
                takeGridRef.current.gridValidToMs ?? Infinity,
                Math.max(0, Math.round(gridMs))
              ),
            };
          }
          clearTakeGridChangeTimers();
        });
      }, waitMs);
      takeGridChangeTimersRef.current.push({ handle, gridMs });
    }
    if (takeGridChangeTimersRef.current.length > 0) {
      console.log(
        `[timing] take grid: ${takeGridChangeTimersRef.current.length} change(s) scheduled off the downbeat anchor`
      );
    }
  }

  // Persistent "use the metronome in the take" flag. Stays put regardless of
  // whether the preview is currently sounding — stopping the preview must not
  // disable the click during recording. Turning it off silences any preview.
  function setMetronomeEnabledForTake(nextEnabled: boolean) {
    setRecordingMetronomeEnabled(nextEnabled);
    if (!nextEnabled && !isArmingRecording && !recording.isRecording && !recording.isPaused) {
      void stopRecordingMetronome();
    }
  }

  // Start/stop only the audible preview while idle, without changing whether the
  // metronome is enabled for the take. Lets you silence the preview but still
  // have the click during recording (or audition without committing).
  async function toggleMetronomeSound() {
    if (isArmingRecording || recording.isRecording || recording.isPaused) {
      return;
    }
    if (!metronome.isNativeAvailable) {
      return;
    }

    if (metronome.isRunning && !metronome.isCountIn) {
      await stopRecordingMetronome();
      return;
    }

    try {
      await metronome.start({ manageAudioSession: true });
    } catch (error) {
      console.warn("Metronome preview start failed", error);
    }
  }

  async function cancelPendingRecordingStart() {
    takeGridRef.current = null;
    setLiveTakeGrid(null);
    setMidTakeRouteChangeMs(null);
    countInPendingRef.current = false;
    setIsArmingRecording(false);
    setOverdubReviewLocked(false);
    clearMonitoringDelayTimer();
    await stopGuideMix();
    await stopRecordingMetronome();
    await recording.cancelPreparedRecording();
  }

  async function cancelRecording() {
    if (!recordingIdea) return;
    if (isArmingRecording) {
      await cancelPendingRecordingStart();
    } else {
      takeGridRef.current = null;
      setOverdubReviewLocked(false);
      clearMonitoringDelayTimer();
      await stopGuideMix();
      await stopRecordingMetronome();
      await recording.discardRecording();
    }
    if (recordingIdea.kind === "clip" && recordingIdea.clips.length === 0) {
      updateIdeas((prevIdeas) => prevIdeas.filter((idea) => idea.id !== recordingIdea.id));
    }
    clearRecordingContext();
  }

  /** Scrap the in-flight take and reset to Ready WITHOUT leaving the screen: the file is
   *  discarded, but the session — settings, guide, metronome grid, one-shot count-in —
   *  stays armed exactly as it was, so the next attempt is one tap away. */
  async function redoTake() {
    if (!isArmingRecording && !recording.isRecording && !recording.isPaused) {
      return;
    }
    // The count-in completion effect consumes countInBars (one-shot); a redo should run
    // the next attempt identically, so restore it from the take's grid snapshot.
    const takeCountInBars = takeGridRef.current?.countInBars ?? 0;
    if (isArmingRecording) {
      await cancelPendingRecordingStart();
    } else {
      takeGridRef.current = null;
      setMidTakeRouteChangeMs(null);
      setOverdubReviewLocked(false);
      autoStoppingOverdubRef.current = false;
      clearMonitoringDelayTimer();
      await stopGuideMix();
      await stopRecordingMetronome();
      await recording.discardRecording();
    }
    if (takeCountInBars > 0) {
      metronome.setCountInBarsValue(takeCountInBars);
    }
  }

  function confirmRedoTake() {
    AppAlert.destructive(
      t("recording.redoTitle"),
      t("recording.redoBody"),
      () => {
        void redoTake();
      },
      { confirmLabel: t("recording.redo"), cancelLabel: t("recording.keepRecording"), icon: actionIcons.restore }
    );
  }

  function confirmDiscardAndExit() {
    const hasRecordingToDiscard =
      isArmingRecording || recording.isRecording || recording.isPaused || recording.elapsedMs > 0;
    if (!hasRecordingToDiscard) {
      navigation.goBack();
      return;
    }

    AppAlert.destructive(
      t("recording.discardTitle"),
      t("recording.discardBody"),
      () => {
        cancelRecording().then(() => navigation.goBack());
      },
      { confirmLabel: t("recording.discard"), cancelLabel: t("recording.keepRecording"), icon: actionIcons.discard }
    );
  }

  async function requestSaveRecording() {
    if (!recordingIdea) return;
    if (isArmingRecording) return;
    if (quickNameModalVisible) return;
    if (!recording.isRecording && !recording.isPaused) return;
    if (recording.isRecording && !recording.isPaused) {
      await recording.pauseRecording();
      await pauseGuideMix();
      await stopRecordingMetronome();
    }

    setQuickNamingIdeaId(recordingIdea.id);
    setQuickNameDraft("");
    setIsPrimaryDraft(false);
    setSaveDestinationOverride(null);
    setQuickNameModalVisible(true);
  }

  function handleSelectSaveDestination(destination: SaveDestination) {
    setSaveDestinationOverride(destination);
    setSaveDestinationPickerVisible(false);
  }

  async function redoOverdubRecording() {
    takeGridRef.current = null;
    setLiveTakeGrid(null);
    setQuickNameModalVisible(false);
    setQuickNameDraft("");
    setQuickNamingIdeaId(null);
    setOverdubReviewLocked(false);
    await stopGuideMix();
    await stopRecordingMetronome();
    await recording.discardRecording();
  }

  function handleQuickNameCancel() {
    if (recordingOverdubClip && overdubReviewLocked) {
      AppAlert.destructive(
        t("recording.reviewOverdub"),
        t("recording.reviewOverdubBody"),
        () => {
          void redoOverdubRecording();
        },
        { confirmLabel: t("recording.redoOverdub"), cancelLabel: t("recording.keepTake"), icon: actionIcons.restore }
      );
      return;
    }

    setQuickNameModalVisible(false);
  }

  async function saveQuickClipName() {
    if (!quickNamingIdeaId) return false;
    const targetIdea = recordingIdea;
    const isStandaloneClipRecording = targetIdea?.kind === "clip";
    const overdubSaveTarget =
      recordingIdeaId && recordingOverdubClipId
        ? {
            ideaId: recordingIdeaId,
            clipId: recordingOverdubClipId,
            title:
              quickNameDraft.trim() ||
              (recordingOverdubClip ? getDefaultOverdubStemTitle(recordingOverdubClip) : t("recording.layerOne")),
          }
        : null;

    pendingOverdubSaveRef.current = overdubSaveTarget;

    const saved = await recording.saveRecording();
    pendingOverdubSaveRef.current = null;
    if (!saved) {
      if (overdubSaveTarget) {
        setQuickNameModalVisible(false);
        setQuickNameDraft("");
        setQuickNamingIdeaId(null);
        setSaveDestinationOverride(null);
        clearRecordingContext();
      }
      return false;
    }
    await stopGuideMix();
    await stopRecordingMetronome();

    if (recordingOverdubClip) {
      setQuickNameModalVisible(false);
      setQuickNameDraft("");
      setQuickNamingIdeaId(null);
      setOverdubReviewLocked(false);
      setSaveDestinationOverride(null);
      clearRecordingContext();
      void maybeRequestReviewAfterSave();
      return true;
    }

    const suggestedTitle =
      recordingIdea?.kind === "project"
        ? (() => {
            const parentClip = recordingParentClipId
              ? recordingIdea.clips.find((c) => c.id === recordingParentClipId) ?? null
              : null;
            const suggested = parentClip
              ? genChildClipTitle(recordingIdea.clips, parentClip)
              : genRootClipTitle(recordingIdea.clips);
            return ensureUniqueCountedTitle(suggested, recordingIdea.clips.map((c) => c.title));
          })()
        : ensureUniqueCountedTitle(
            recordingIdea?.title || fallbackClipTitle(),
            (workspaces.find((w) => w.id === activeWorkspaceId)?.ideas ?? [])
              .filter((idea) => idea.kind === "clip" && idea.id !== recordingIdea?.id)
              .map((idea) => idea.title)
          );
    const nextTitle = quickNameDraft.trim() || suggestedTitle;

    updateIdeas((prevIdeas) =>
      prevIdeas.map((idea) => {
        if (idea.id !== quickNamingIdeaId) return idea;
        const firstClipId = idea.clips[0]?.id;
        if (!firstClipId) return idea;

        if (idea.kind === "clip") {
          return {
            ...idea,
            title: nextTitle,
            clips: idea.clips.map((clip) =>
              clip.id === firstClipId ? { ...clip, title: nextTitle } : clip
            ),
          };
        }

        return {
          ...idea,
          clips: idea.clips.map((clip) =>
            clip.id === firstClipId ? { ...clip, title: nextTitle } : clip
          ),
        };
      })
    );

    const savedIdeaBeforeRelocation = useStore
      .getState()
      .workspaces.find((workspace) => workspace.id === activeWorkspaceId)
      ?.ideas.find((idea) => idea.id === quickNamingIdeaId);

    if (
      isStandaloneClipRecording &&
      saveDestinationOverride &&
      activeWorkspaceId &&
      (saveDestinationOverride.workspaceId !== activeWorkspaceId ||
        saveDestinationOverride.collectionId !== savedIdeaBeforeRelocation?.collectionId)
    ) {
      appActions.relocateIdeaToCollection(
        quickNamingIdeaId,
        activeWorkspaceId,
        saveDestinationOverride.workspaceId,
        saveDestinationOverride.collectionId
      );
    }

    const finalWorkspaceId = saveDestinationOverride?.workspaceId ?? activeWorkspaceId;
    const savedIdea = useStore
      .getState()
      .workspaces.find((workspace) => workspace.id === finalWorkspaceId)
      ?.ideas.find((idea) => idea.id === quickNamingIdeaId);
    const savedClipId = savedIdea?.clips[0]?.id ?? null;
    if (savedIdea) {
      useStore
        .getState()
        .logIdeaActivity(
          savedIdea.id,
          isStandaloneClipRecording ? "created" : "updated",
          "recording",
          savedClipId
        );
    }

    setQuickNameModalVisible(false);
    setQuickNameDraft("");
    setQuickNamingIdeaId(null);
    setOverdubReviewLocked(false);
    setSaveDestinationOverride(null);
    clearRecordingContext();
    void maybeRequestReviewAfterSave();
    return true;
  }

  useEffect(() => {
    if (recordingSaveRequestToken === handledSaveRequestRef.current) return;
    handledSaveRequestRef.current = recordingSaveRequestToken;
    if (!recordingSaveRequestToken) return;
    void requestSaveRecording();
  }, [recordingSaveRequestToken]);

  // Latest take state for the device-change listener (it outlives renders).
  const takeStateRef = useRef({ capturing: false, elapsedMs: 0 });
  takeStateRef.current = {
    capturing: recording.isRecording || recording.isPaused,
    elapsedMs: recording.elapsedMs,
  };
  const lastMonitoringRouteKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshCurrentRecordingInput() {
      try {
        const device = await audioDeviceManager.getCurrentDevice();
        const outputRoute = await SongNookMetronomeModule?.getCurrentAudioOutputRoute?.();
        if (!cancelled) {
          setCurrentRecordingInput(device ?? null);
          setCurrentMonitoringOutput(outputRoute ?? null);

          // Mid-take route change (headphones died, BT reconnected…): every latency in
          // the model just changed, so the grid reference is broken from here on. Stamp
          // the take instead of silently pretending the grid survived.
          const routeKey = buildBluetoothMonitoringRouteKey(outputRoute ?? null);
          const previousRouteKey = lastMonitoringRouteKeyRef.current;
          lastMonitoringRouteKeyRef.current = routeKey;
          if (
            previousRouteKey !== null &&
            routeKey !== previousRouteKey &&
            takeStateRef.current.capturing
          ) {
            const atMs = Math.max(0, Math.round(takeStateRef.current.elapsedMs));
            console.warn(`[timing] audio route changed mid-take at ${atMs}ms — grid marked`);
            setMidTakeRouteChangeMs((current) => current ?? atMs);
            if (takeGridRef.current) {
              takeGridRef.current = {
                ...takeGridRef.current,
                gridValidToMs: Math.min(takeGridRef.current.gridValidToMs ?? Infinity, atMs),
              };
            }
          }
        }
      } catch {
        if (!cancelled) {
          setCurrentRecordingInput(null);
          setCurrentMonitoringOutput(null);
        }
      }
    }

    void refreshCurrentRecordingInput();
    const removeListener = audioDeviceManager.addDeviceChangeListener(() => {
      void refreshCurrentRecordingInput();
    });

    return () => {
      cancelled = true;
      removeListener();
    };
  }, []);

  useEffect(() => {
    if (!recordingOverdubClip) {
      return;
    }
    if (!recording.isRecording || recording.isPaused || isArmingRecording || quickNameModalVisible) {
      return;
    }
    if (!guideMixDurationMs || guideMixDurationMs <= 0) {
      return;
    }
    if (recording.elapsedMs < guideMixDurationMs) {
      return;
    }
    if (autoStoppingOverdubRef.current) {
      return;
    }

    autoStoppingOverdubRef.current = true;
    setOverdubReviewLocked(true);
    void requestSaveRecording().finally(() => {
      autoStoppingOverdubRef.current = false;
    });
  }, [
    guideMixDurationMs,
    isArmingRecording,
    quickNameModalVisible,
    recording.elapsedMs,
    recording.isPaused,
    recording.isRecording,
    recordingOverdubClip,
  ]);

  // Preset the metronome from the target clip's saved recording grid so overdubs and
  // variations line up with the take the original was actually recorded against —
  // regardless of what the global metronome was changed to since. The WHOLE grid is
  // mirrored: tempo, meter, count-in bars, and whether the click ran through the take,
  // so opening an overdub session lands ready-to-record with the master's settings.
  // Runs once per target clip; everything stays adjustable afterwards.
  const takeGridSourceClip = useMemo(
    () =>
      recordingOverdubClip ??
      (recordingParentClipId && recordingIdea
        ? recordingIdea.clips.find((clip) => clip.id === recordingParentClipId) ?? null
        : null),
    [recordingIdea, recordingOverdubClip, recordingParentClipId]
  );
  const restoredGridLabel = takeGridSourceClip?.recordingGrid
    ? t("recording.originalTake", {
        bpm: takeGridSourceClip.recordingGrid.bpm,
        meter: takeGridSourceClip.recordingGrid.meterId,
      })
    : null;

  // The sketch's programmed tempo/meter changes — editable only for fresh takes into a
  // sketch. Overdubs and variations inherit the MASTER's frozen grid instead; the plan
  // never rewrites, and is never edited from, an existing take's session.
  const canEditSongGrid = recordingIdea?.kind === "project" && !takeGridSourceClip;
  const songGrid = canEditSongGrid ? recordingIdea?.songGrid ?? null : null;
  const handleSongGridChange = useCallback(
    (next: TempoMap | null) => {
      if (!recordingIdea || recordingIdea.kind !== "project") {
        return;
      }
      useStore.getState().setSongGrid(recordingIdea.id, next ?? undefined);
    },
    [recordingIdea]
  );
  const restoredGridClipIdRef = useRef<string | null>(null);
  useEffect(() => {
    const grid = takeGridSourceClip?.recordingGrid;
    if (!takeGridSourceClip || !grid) {
      return;
    }
    if (restoredGridClipIdRef.current === takeGridSourceClip.id) {
      return;
    }
    restoredGridClipIdRef.current = takeGridSourceClip.id;
    metronome.setBpmValue(grid.bpm);
    metronome.setMeterIdValue(grid.meterId);
    metronome.setCountInBarsValue(grid.countInBars);
    // The take's FEEL travels too: a 5/4 master recorded 3+2 must click 3+2 under
    // the overdub. No stored grouping = restore the meter's default feel.
    metronome.setGrouping(grid.meterId, grid.grouping ?? null);
    setRecordingMetronomeEnabled(grid.clickThroughTake);
  }, [metronome, takeGridSourceClip]);

  useEffect(() => {
    if (initializedMetronomeRef.current) {
      return;
    }
    initializedMetronomeRef.current = true;

    if (!recording.isRecording && !recording.isPaused && (metronome.isRunning || metronome.isCountIn)) {
      void stopRecordingMetronome();
    }
  }, [metronome.isCountIn, metronome.isRunning, recording.isPaused, recording.isRecording]);

  useEffect(() => {
    if (!countInPendingRef.current || metronome.countInCompletionToken === 0) {
      return;
    }

    countInPendingRef.current = false;
    const mode = countInModeRef.current;
    void (async () => {
      const delayMs = activeMonitoringCompensationMs;
      let started = false;

      if (mode === "resume") {
        // Resume is the one place the compensation wait survives: a head trim can't fix
        // alignment mid-file, so delaying the recorder by the ear latency remains the
        // least-bad option for resumed BT takes.
        await resumeGuideMix();
        await waitForMonitoringCompensation(delayMs);
        await recording.resumeRecording();
        started = true;
      } else {
        // Capture has been rolling since before the count-in (record-through). Nothing to
        // start here — instead, measure where the musical start lands in the capture and
        // commit that head for trimming at save. The completion event fires ON the last
        // count-in click, one beat interval before the actual downbeat, so the downbeat
        // epoch computed from the grid anchor is (correctly) in the near future.
        started = recording.isRecording;
        const captureStartEpochMs = recording.getCaptureStartEpochMs();
        const anchor = await SongNookMetronomeModule?.getGridAnchor?.().catch(() => null);

        // CRITICAL time-domain correction: the grid anchor and player positions live in
        // the RENDER domain, but the performer plays to what they PERCEIVE and the mic
        // stamps that another input-latency later. The latency model owns all of it:
        // route output latency (OS-reported, bar-stripped, or BT ear-calibration),
        // input latency, and the reference modality — an overdub locks to the audible
        // guide; a solo take locks to whichever met cue is active (audible > haptic >
        // visual), so a silent-click take no longer gets an audible-domain correction.
        const barMs =
          anchor?.msPerPulse != null
            ? anchor.msPerPulse * (anchor.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar)
            : null;
        const latencyProfile = await resolveCurrentRouteLatencyProfile({
          calibrations: bluetoothMonitoringCalibrations,
          activeOutputs: recordingGuideMixUri
            ? { beep: true, visual: false, haptic: false }
            : metronome.outputs,
          clickLoopBarMs: barMs,
        });
        const audibleCorrectionMs = latencyProfile.recordingCorrectionMs;
        console.log(`[timing] latency profile: ${formatLatencyProfileLog(latencyProfile)}`);
        if (latencyProfile.sources.output === "unknown" && latencyProfile.referenceModality === "audible") {
          console.log("[timing] OUTPUT LATENCY UNKNOWN — trim stays render-domain");
        }
        const grid = takeGridRef.current;
        const countInPulses =
          (grid?.countInBars ?? 0) * (anchor?.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar);
        const downbeatEpochMs =
          anchor?.isRunning && anchor.anchorEpochMs != null && anchor.msPerPulse != null
            ? anchor.anchorEpochMs + countInPulses * anchor.msPerPulse
            : null;

        let headMs = 0;
        if (recordingGuideMixUri) {
          // The guide start was phase-locked and scheduled during the count-in (measured
          // play() latency, no seek). Await its measured start epoch for the trim math.
          let guideStartEpochMs: number | null = null;
          const scheduledGuideStart = guideScheduleRef.current.promise;
          if (scheduledGuideStart) {
            guideStartEpochMs = await scheduledGuideStart;
          }
          if (guideStartEpochMs == null) {
            // Fallback (anchor unavailable / schedule invalidated): aim at the downbeat
            // with the fixed lead and measure after the fact — alignment of the RECORDED
            // stem stays exact either way; only live-click phase is coarser here.
            if (downbeatEpochMs != null) {
              const aimWaitMs = downbeatEpochMs - Date.now() - GUIDE_DOWNBEAT_LEAD_MS;
              if (aimWaitMs > 0) {
                await waitForMonitoringCompensation(aimWaitMs);
              }
            }
            guideStartEpochMs = await startGuideMixFromBeginningAnchored(
              punchInMs > 0 ? { seekPositionMs: punchInMs, anchorPositionMs: punchInMs } : undefined
            );
          }

          if (captureStartEpochMs != null && guideStartEpochMs != null) {
            headMs =
              guideStartEpochMs -
              captureStartEpochMs +
              audibleCorrectionMs -
              HEAD_TRIM_SAFETY_EARLY_MS;
          }
        } else if (captureStartEpochMs != null && downbeatEpochMs != null) {
          headMs =
            downbeatEpochMs -
            captureStartEpochMs +
            audibleCorrectionMs -
            HEAD_TRIM_SAFETY_EARLY_MS;
        }
        // headMs <= 0 or unmeasurable → commit 0: the take keeps its pre-roll instead of
        // guessing a cut (never trim on a guess).
        console.log(
          `[timing] head trim committed: ${Math.round(headMs)}ms ` +
            `(captureStart=${captureStartEpochMs != null ? "measured" : "MISSING"}, ` +
            `anchor=${downbeatEpochMs != null ? "measured" : "MISSING"})`
        );
        recording.commitHeadTrim(headMs);
        if (downbeatEpochMs != null && captureStartEpochMs != null && anchor?.msPerPulse) {
          setLiveTakeGrid({
            firstBeatCaptureMs: downbeatEpochMs - captureStartEpochMs + audibleCorrectionMs,
            beatMs: anchor.msPerPulse,
            pulsesPerBar: anchor.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar,
            tempoMap: takeGridRef.current?.tempoMap ?? null,
          });
        }

        // Programmed tempo/meter changes: the map-native engine already schedules them
        // sample-exactly; the JS scheduler is the fallback for older binaries only.
        if (downbeatEpochMs != null && !takeUsesNativeMapRef.current) {
          scheduleTakeGridChanges(downbeatEpochMs);
        }
      }

      setIsArmingRecording(false);
      if (!started) {
        await stopRecordingMetronome();
        await stopGuideMix();
        await recording.cancelPreparedRecording();
        return;
      }

      // Count-in is one-shot: clear it so the next take doesn't auto-count-in unless the
      // user explicitly re-enables it.
      metronome.setCountInBarsValue(0);

      // If the metronome wasn't meant to click through the take, silence it now that the
      // count-in is done and recording has begun.
      if (!recordingMetronomeEnabled) {
        await stopRecordingMetronome();
      }
    })();
  }, [
    activeMonitoringCompensationMs,
    metronome.countInCompletionToken,
    metronome.meterPreset.pulsesPerBar,
    metronome.setCountInBarsValue,
    bluetoothMonitoringCalibrations,
    metronome.outputs,
    recording,
    recordingGuideMixUri,
    recordingMetronomeEnabled,
    recordingOverdubClip,
  ]);

  useEffect(() => {
    if (recording.interruptionToken === 0) {
      return;
    }

    countInPendingRef.current = false;
    setIsArmingRecording(false);

    void (async () => {
      await stopGuideMix();
      if (metronome.isRunning || metronome.isCountIn) {
        try {
          await metronome.stop();
        } catch (error) {
          console.warn("Recording metronome stop after interruption failed", error);
        }
      }
    })();
  }, [metronome.isCountIn, metronome.isRunning, metronome.stop, recording.interruptionToken]);

  async function handleStartRecording() {
    if (isArmingRecording) {
      return;
    }
    if (overdubReviewLocked) {
      return;
    }

    autoStoppingOverdubRef.current = false;
    setMidTakeRouteChangeMs(null);
    setSettingsVisible(false);
    setMetronomeSheetVisible(false);

    // Count-in is independent of whether the metronome clicks through the take: a count-in
    // can run (using the metronome's bpm/meter/cues) even when the metronome itself is "off",
    // in which case the click is silenced the moment recording begins (see the count-in
    // completion effect). The click only continues into the take when the metronome is enabled.
    const wantsCountIn = metronome.countInBars > 0 && metronome.isNativeAvailable;
    const wantsClickDuringTake = recordingMetronomeEnabled && metronome.isNativeAvailable;

    // The timebase this take will be played to. Programmed changes need the measured
    // downbeat anchor to schedule from, so a multi-segment map is only stamped on
    // count-in takes (v1); without one the take stays a single-tempo grid.
    const takeTempoMap = (() => {
      if (!wantsCountIn || !wantsClickDuringTake) {
        return undefined;
      }
      const masterGrid = takeGridSourceClip?.recordingGrid;
      if (masterGrid) {
        // Overdub/variation: the master's map is the truth — but only while the
        // sheet still matches its segment 1. A deliberately changed tempo means
        // the musician left the master's grid; stamp their single-tempo choice.
        const masterMap = gridTempoMap(masterGrid);
        const first = masterMap.segments[0];
        return masterMap.segments.length > 1 &&
          first.bpm === metronome.bpm &&
          first.meterId === metronome.meterId
          ? masterMap
          : undefined;
      }
      const plan = recordingIdea?.kind === "project" ? recordingIdea.songGrid : undefined;
      if (!plan || plan.segments.length === 0) {
        return undefined;
      }
      // The sheet's live tempo/meter IS segment 1; the plan contributes the changes.
      const merged = normalizeTempoMap({
        schemaVersion: TEMPO_MAP_SCHEMA_VERSION,
        segments: [
          { atBar: 1, bpm: metronome.bpm, meterId: metronome.meterId },
          ...plan.segments.filter((segment) => segment.atBar > 1),
        ],
      });
      return merged.segments.length > 1 ? merged : undefined;
    })();

    // Snapshot the beat grid this take is recorded against before anything can mutate the
    // global metronome settings (the count-in completion effect resets countInBars to 0).
    takeGridRef.current =
      wantsCountIn || wantsClickDuringTake
        ? {
            bpm: metronome.bpm,
            meterId: metronome.meterId,
            countInBars: wantsCountIn ? metronome.countInBars : 0,
            clickThroughTake: wantsClickDuringTake,
            firstDownbeatMs: null,
            source: "metronome",
            ...(takeTempoMap ? { tempoMap: takeTempoMap } : {}),
            // The feel is part of the grid: only a customised grouping is stored
            // (absent = the meter's default, per the RecordingGrid contract).
            ...(isSameGrouping(metronome.grouping, metronome.meterPreset.defaultGrouping)
              ? {}
              : { grouping: [...metronome.grouping] }),
          }
        : null;

    if (wantsCountIn) {
      const prepared = await recording.prepareRecording();
      if (!prepared) {
        return;
      }

      setIsArmingRecording(true);
      try {
        // If the metronome was already clicking as a pre-recording preview, restart it cleanly
        // for the count-in rather than layering the count-in on top of the running loop.
        const alreadyPreviewing = metronome.isRunning && !metronome.isCountIn;
        if (alreadyPreviewing) {
          await metronome.stop();
          await new Promise((resolve) => setTimeout(resolve, 180));
        }

        // Record THROUGH the count-in: capture rolls before the first click, the count-in
        // completion effect measures where the musical start (downbeat / guide start)
        // landed in the capture, and the head is trimmed at save. Starting capture at the
        // completion event instead used to leave a random ~half-beat of pre-roll (the JS
        // chain raced the final count-in beat).
        const started = await recording.startPreparedRecording();
        if (!started) {
          setIsArmingRecording(false);
          return;
        }
        recording.armHeadTrim();

        countInModeRef.current = "start";
        countInPendingRef.current = true;
        // Map-capable binaries schedule the take's tempo/meter changes natively
        // (sample-exact, seamless); the JS boundary scheduler stays as the fallback.
        const nativeMapSegments =
          takeGridRef.current?.tempoMap &&
          takeGridRef.current.tempoMap.segments.length > 1 &&
          SongNookMetronomeModule?.supportsTempoMap?.()
            ? nativeTempoMapSegments(takeGridRef.current)
            : null;
        takeUsesNativeMapRef.current = !!nativeMapSegments;
        await metronome.startCountIn(metronome.countInBars, {
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
          tempoMapSegments: nativeMapSegments ?? undefined,
        });

        // Overdub: use the count-in itself to phase-lock the guide — measure its play()
        // latency muted, then schedule the audible start pre-compensated to land the
        // guide's t=0 (its measured downbeat) exactly on the live metronome's downbeat.
        if (recordingGuideMixUri) {
          void (async () => {
            await waitPlainMs(120); // let the engine's audio clock settle before anchoring
            const anchor = await SongNookMetronomeModule?.getGridAnchor?.().catch(() => null);
            if (!anchor?.isRunning || anchor.anchorEpochMs == null || anchor.msPerPulse == null) {
              console.log("[timing] grid anchor unavailable — guide falls back to aim-at-completion");
              return;
            }
            const grid = takeGridRef.current;
            const countInPulses =
              (grid?.countInBars ?? 0) * (anchor.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar);
            const downbeatEpochMs = anchor.anchorEpochMs + countInPulses * anchor.msPerPulse;
            const masterFirstDownbeatMs =
              recordingOverdubClip?.recordingGrid?.firstDownbeatMs ?? null;
            if (punchInMs === 0 && masterFirstDownbeatMs == null) {
              console.log(
                "[timing] master has no measured downbeat (recorded before trimming) — " +
                  "starting guide at the live downbeat; its internal pre-roll cannot be locked"
              );
            }
            if (punchInMs === 0 && masterFirstDownbeatMs != null && masterFirstDownbeatMs > 0) {
              // Untrimmed master (e.g. recorded over a running preview): the guide is
              // deliberately started EARLY so its internal downbeat lands on the live
              // one — its pre-roll plays DURING the count-in, which sounds like a
              // "ghost count-in". Log it so on-device reports are diagnosable.
              console.log(
                `[timing] master pre-roll: guide enters ${Math.round(masterFirstDownbeatMs)}ms ` +
                  "before the downbeat (master audio starts before its own first bar line)"
              );
            }
            // The guide rides the MEDIA PLAYER pipeline, which reaches the ear later
            // than the click pipeline (ExoPlayer buffering). Start it early by the
            // measured difference so guide and click land together in the ear.
            const profile = await resolveCurrentRouteLatencyProfile({
              calibrations: bluetoothMonitoringCalibrations,
              activeOutputs: { beep: true, visual: false, haptic: false },
              clickLoopBarMs: anchor.msPerPulse * (anchor.pulsesPerBar ?? 4),
            }).catch(() => null);
            const guideAdvanceMs = profile?.guideStartAdvanceMs ?? 0;
            if (guideAdvanceMs > 0) {
              console.log(`[timing] guide start advanced ${Math.round(guideAdvanceMs)}ms (player vs click pipeline)`);
            }
            if (punchInMs > 0) {
              // Punch take: the count-in clicks ARE the lead-in; the master enters
              // exactly at the punch point on the downbeat. The punch is bar-snapped on
              // the master's grid, so no firstDownbeat shift applies.
              console.log(`[timing] punch-in: master enters at ${Math.round(punchInMs)}ms on the downbeat`);
              void schedulePhaseLockedGuideStart(downbeatEpochMs - guideAdvanceMs, {
                seekPositionMs: punchInMs,
                anchorPositionMs: punchInMs,
              });
            } else {
              void schedulePhaseLockedGuideStart(
                downbeatEpochMs - (masterFirstDownbeatMs ?? 0) - guideAdvanceMs
              );
            }
          })();
        }
      } catch (error) {
        console.warn("Recording count-in start failed", error);
        countInPendingRef.current = false;
        await stopGuideMix();
        await stopRecordingMetronome();
        await recording.cancelPreparedRecording();
        setIsArmingRecording(false);
      }
      return;
    }

    if (!wantsClickDuringTake) {
      if (recordingGuideMixUri) {
        // Overdub without count-in: same record-through + measured-trim discipline as the
        // count-in path. Capture rolls FIRST, the guide's actual audio start is measured
        // off its playback position, and the head is cut so file t=0 lands on the guide's
        // t=0. The recorder is never sleep-gated on the BT monitoring compensation
        // anymore — that shifted the whole file by an EAR-delay (cue-domain) number, and
        // left uncalibrated routes to a JS race.
        const prepared = await recording.prepareRecording();
        if (!prepared) {
          return;
        }

        setIsArmingRecording(true);
        try {
          const started = await recording.startPreparedRecording();
          if (!started) {
            return;
          }
          recording.armHeadTrim();
          // Punch take: monitor from a bar before the punch (grid-true lead-in); the
          // trim anchors at the punch point itself.
          const guideStartEpochMs = await startGuideMixFromBeginningAnchored(
            punchInMs > 0
              ? {
                  seekPositionMs: Math.max(0, punchInMs - punchLeadInMs),
                  anchorPositionMs: punchInMs,
                }
              : undefined
          );
          const captureStartEpochMs = recording.getCaptureStartEpochMs();
          const profile = await resolveCurrentRouteLatencyProfile({
            calibrations: bluetoothMonitoringCalibrations,
            activeOutputs: { beep: true, visual: false, haptic: false },
          }).catch(() => null);
          if (profile) {
            console.log(`[timing] latency profile: ${formatLatencyProfileLog(profile)}`);
          }
          // Unmeasurable → commit 0: keep the pre-roll instead of guessing a cut.
          let headMs = 0;
          if (guideStartEpochMs != null && captureStartEpochMs != null) {
            headMs =
              guideStartEpochMs -
              captureStartEpochMs +
              (profile?.recordingCorrectionMs ?? 0) -
              HEAD_TRIM_SAFETY_EARLY_MS;
          }
          console.log(
            `[timing] no-count-in overdub head trim: ${Math.round(headMs)}ms ` +
              `(guideStart=${guideStartEpochMs != null ? "measured" : "MISSING"}, ` +
              `captureStart=${captureStartEpochMs != null ? "measured" : "MISSING"})`
          );
          recording.commitHeadTrim(headMs);
        } finally {
          setIsArmingRecording(false);
        }
        return;
      }

      await recording.startRecording();
      return;
    }

    const prepared = await recording.prepareRecording();
    if (!prepared) {
      return;
    }

    setIsArmingRecording(true);

    try {
      const alreadyPreviewing = metronome.isRunning && !metronome.isCountIn;

      // Record-through, no count-in: capture starts BEFORE the click/guide so the musical
      // start can be measured and trimmed (overdubs and fresh click starts) or stamped
      // (record hit over a running preview). No sleep-gating of the recorder.
      const started = await recording.startPreparedRecording();
      if (!started) {
        await stopRecordingMetronome();
        return;
      }

      const trimming = Boolean(recordingGuideMixUri) || !alreadyPreviewing;
      if (trimming) {
        recording.armHeadTrim();
      }

      if (!alreadyPreviewing) {
        await metronome.start({
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
        });
      }
      // Let the engine's audio clock settle before anchoring — but a single fixed wait
      // raced it: when the anchor query landed early the grid saved with a NULL downbeat
      // and the player silently drew no bar lines. Poll until the engine reports running.
      type GridAnchorReport = {
        isRunning?: boolean;
        anchorEpochMs?: number | null;
        msPerPulse?: number | null;
        pulsesPerBar?: number | null;
      };
      let anchor: GridAnchorReport | null = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await waitPlainMs(attempt === 0 ? 120 : 80);
        anchor = (await SongNookMetronomeModule?.getGridAnchor?.().catch(() => null)) ?? null;
        if (anchor?.isRunning && anchor.anchorEpochMs != null && anchor.msPerPulse != null) {
          break;
        }
      }
      if (!(anchor?.isRunning && anchor?.anchorEpochMs != null)) {
        console.warn("[timing] grid anchor unavailable after retries — grid will rely on click self-align");
      }
      const anchorEpochMs =
        anchor?.isRunning && anchor.anchorEpochMs != null && anchor.msPerPulse != null
          ? anchor.anchorEpochMs
          : null;
      const barMs =
        anchor?.msPerPulse != null
          ? anchor.msPerPulse * (anchor.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar)
          : null;
      const profile = await resolveCurrentRouteLatencyProfile({
        calibrations: bluetoothMonitoringCalibrations,
        activeOutputs: recordingGuideMixUri
          ? { beep: true, visual: false, haptic: false }
          : metronome.outputs,
        clickLoopBarMs: barMs,
      }).catch(() => null);
      const correctionMs = profile?.recordingCorrectionMs ?? 0;
      if (profile) {
        console.log(`[timing] latency profile: ${formatLatencyProfileLog(profile)}`);
      }

      // Guide + click with no count-in: still phase-lock them. The guide joins at the
      // earliest bar line far enough out to run the muted rehearsal — effectively an
      // implicit one-bar count-in with the click running (shorter when a resume-latency
      // measurement is already cached from an earlier take this session).
      let guideStartEpochMs: number | null = null;
      if (recordingGuideMixUri) {
        if (anchorEpochMs != null && barMs != null && barMs > 0) {
          const masterFirstDownbeatMs =
            recordingOverdubClip?.recordingGrid?.firstDownbeatMs ?? null;
          const guideAdvanceMs = profile?.guideStartAdvanceMs ?? 0;
          // Punch take: the guide's audible entry is a bar BEFORE the punch (the lead-in),
          // so the muted rehearsal window must clear that much earlier too.
          const barsAhead = Math.max(
            1,
            Math.ceil((Date.now() + guideLockLeadNeededMs() + punchLeadInMs - anchorEpochMs) / barMs)
          );
          const targetEpochMs = anchorEpochMs + barsAhead * barMs;
          console.log(
            `[timing] no-count-in guide lock: joining at the bar line ` +
              `${Math.round(targetEpochMs - Date.now())}ms out` +
              (punchInMs > 0
                ? ` (punch at ${Math.round(punchInMs)}ms, lead-in ${Math.round(punchLeadInMs)}ms)`
                : "") +
              (guideAdvanceMs > 0 ? ` (guide advanced ${Math.round(guideAdvanceMs)}ms)` : "")
          );
          // The countdown targets the join as the performer HEARS it, not as the app
          // renders it — the click correction is the same delay their ears live behind.
          // For a punch take the master becomes audible a lead-in bar before the punch.
          setGuideJoinInfo({
            joinAtEpochMs: targetEpochMs - punchLeadInMs + correctionMs,
            beatMs: barMs / (anchor?.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar),
          });
          guideStartEpochMs = await schedulePhaseLockedGuideStart(
            punchInMs > 0
              ? targetEpochMs - guideAdvanceMs
              : targetEpochMs - (masterFirstDownbeatMs ?? 0) - guideAdvanceMs,
            punchInMs > 0
              ? {
                  seekPositionMs: Math.max(0, punchInMs - punchLeadInMs),
                  anchorPositionMs: punchInMs,
                }
              : undefined
          );
          setGuideJoinInfo(null);
        }
        if (guideStartEpochMs == null) {
          // Anchor unavailable or the schedule was invalidated: unlocked measured start.
          // The recorded stem still trims exactly; only live click↔guide phase is loose.
          guideStartEpochMs = await startGuideMixFromBeginningAnchored(
            punchInMs > 0
              ? {
                  seekPositionMs: Math.max(0, punchInMs - punchLeadInMs),
                  anchorPositionMs: punchInMs,
                }
              : undefined
          );
        }
      }
      const captureStartEpochMs = recording.getCaptureStartEpochMs();

      if (trimming) {
        // Musical start: the guide's measured t=0 for overdubs, else the engine's first
        // click (pulse 0 — a fresh start has no count-in pulses in front of it).
        const musicalStartEpochMs = guideStartEpochMs ?? anchorEpochMs;
        let headMs = 0;
        if (captureStartEpochMs != null && musicalStartEpochMs != null) {
          headMs =
            musicalStartEpochMs - captureStartEpochMs + correctionMs - HEAD_TRIM_SAFETY_EARLY_MS;
        }
        console.log(
          `[timing] no-count-in head trim: ${Math.round(headMs)}ms ` +
            `(target=${guideStartEpochMs != null ? "guide" : "pulse0"}, ` +
            `captureStart=${captureStartEpochMs != null ? "measured" : "MISSING"})`
        );
        recording.commitHeadTrim(headMs);
        if (musicalStartEpochMs != null && captureStartEpochMs != null && anchor?.msPerPulse) {
          setLiveTakeGrid({
            firstBeatCaptureMs: musicalStartEpochMs - captureStartEpochMs + correctionMs,
            beatMs: anchor.msPerPulse,
            pulsesPerBar: anchor.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar,
            tempoMap: takeGridRef.current?.tempoMap ?? null,
          });
        }
      } else if (
        captureStartEpochMs != null &&
        anchorEpochMs != null &&
        barMs != null &&
        barMs > 0 &&
        takeGridRef.current
      ) {
        // Record hit over a running preview: never chop the take, but stamp where the
        // next bar line falls in the file so downstream beat grids stay honest.
        const barsSinceAnchor = Math.max(
          0,
          Math.ceil((captureStartEpochMs - anchorEpochMs) / barMs)
        );
        const firstDownbeatMs = Math.max(
          0,
          Math.round(anchorEpochMs + barsSinceAnchor * barMs - captureStartEpochMs + correctionMs)
        );
        takeGridRef.current = { ...takeGridRef.current, firstDownbeatMs };
        if (anchor?.msPerPulse) {
          setLiveTakeGrid({
            firstBeatCaptureMs: firstDownbeatMs,
            beatMs: anchor.msPerPulse,
            pulsesPerBar: anchor.pulsesPerBar ?? metronome.meterPreset.pulsesPerBar,
            tempoMap: takeGridRef.current?.tempoMap ?? null,
          });
        }
        console.log(`[timing] preview take: first bar line stamped at ${firstDownbeatMs}ms in-file`);
      }
    } catch (error) {
      console.warn("Recording metronome start failed", error);
      recording.abortHeadTrim();
      await stopGuideMix();
      await stopRecordingMetronome();
      await recording.cancelPreparedRecording();
    } finally {
      setIsArmingRecording(false);
    }
  }

  async function handlePauseRecording() {
    await recording.pauseRecording();
    await pauseGuideMix();
    await stopRecordingMetronome();
  }

  async function handleResumeRecording() {
    if (overdubReviewLocked) {
      return;
    }
    autoStoppingOverdubRef.current = false;

    // The recording audio session has to be live before the click starts: the metronome's
    // engine plays into it with manageAudioSession:false, and starting it against a session
    // that a pause left inactive is why the metronome failed outright on iOS after
    // pause-and-continue. Claiming it here covers both resume paths below.
    await recording.claimAudioSession().catch((error) => {
      console.warn("Recording audio session claim before resume failed", error);
    });

    // If count-in was (re)enabled while paused, run a fresh count-in before resuming. The
    // completion effect handles the actual resume (mode "resume") and one-shot reset.
    const wantsCountIn = metronome.countInBars > 0 && metronome.isNativeAvailable;
    if (wantsCountIn) {
      setIsArmingRecording(true);
      try {
        const alreadyPreviewing = metronome.isRunning && !metronome.isCountIn;
        if (alreadyPreviewing) {
          await metronome.stop();
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
        countInModeRef.current = "resume";
        countInPendingRef.current = true;
        await metronome.startCountIn(metronome.countInBars, {
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
        });
      } catch (error) {
        console.warn("Recording count-in resume failed", error);
        countInPendingRef.current = false;
        await stopRecordingMetronome();
        setIsArmingRecording(false);
      }
      return;
    }

    await resumeGuideMix();
    if (recordingMetronomeEnabled && metronome.isNativeAvailable) {
      // The click must come back in ON the take's grid, not on a fresh downbeat. Capture ms
      // is frozen while paused, so the grid position we left off at is still exactly where
      // capture will resume — see domain/resumeClickPhase for why restarting from pulse 0
      // put the take's second half off the grid its first half was played to.
      const liveGrid = liveTakeGridRef.current;
      const phase = liveGrid
        ? resolveResumeClickPhase({
            captureMs: recording.captureDurationMs,
            firstBeatCaptureMs: liveGrid.firstBeatCaptureMs,
            beatMs: liveGrid.beatMs,
            pulsesPerBar: liveGrid.pulsesPerBar,
            tempoMap: liveGrid.tempoMap ?? null,
            startsEarlyByMs: activeMonitoringCompensationMs,
          })
        : null;
      const at = liveGrid
        ? describeGridPosition({
            captureMs: recording.captureDurationMs,
            firstBeatCaptureMs: liveGrid.firstBeatCaptureMs,
            beatMs: liveGrid.beatMs,
            pulsesPerBar: liveGrid.pulsesPerBar,
            tempoMap: liveGrid.tempoMap ?? null,
          })
        : null;
      console.log(
        `[timing] resume click: ` +
          (phase
            ? `phase ${Math.round(phase.offsetMs)}ms (${phase.unit})` +
              (at ? ` — bar ${at.bar} beat ${at.beat}` : "")
            : "fresh downbeat (no measured grid to continue)")
      );
      try {
        await metronome.start({
          manageAudioSession: false,
          cueDelayMs: activeMonitoringCompensationMs,
          phaseOffsetMs: phase?.offsetMs,
        });
      } catch (error) {
        console.warn("Recording metronome resume failed", error);
      }
    }
    await waitForMonitoringCompensation(activeMonitoringCompensationMs);
    await recording.resumeRecording();
  }

  function minimizeRecording() {
    if (isArmingRecording) {
      void cancelPendingRecordingStart().then(() => navigation.goBack());
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home" as never);
  }

  // Keep an always-current cleanup closure so the unmount effect (which runs with empty deps)
  // sees the latest state instead of a stale snapshot from first render.
  useEffect(() => {
    abandonedPlaceholderCleanupRef.current = () => {
      // Quick Record inserts an empty placeholder "clip" idea up front, before any audio is
      // captured. If the screen is left without ever recording (back button, minimize, hardware
      // back, or swipe gesture), remove that placeholder so it doesn't linger in the collection
      // as a ghost clip. Guarded to only touch an empty standalone-clip placeholder with no take
      // in progress — never a project or an idea that already has clips.
      if (!recordingIdea) return;
      if (recordingIdea.kind !== "clip" || recordingIdea.clips.length > 0) return;
      if (recording.isRecording || recording.isPaused || isArmingRecording || recording.elapsedMs > 0) {
        return;
      }
      if (quickNameModalVisible) return;

      // This can legitimately take the library from one idea to zero (e.g. the user's very
      // first quick-record, abandoned before anything was captured) — authorize it so the
      // persist guard doesn't mistake it for unannounced data loss.
      authorizeIntentionalEmptyStateWrite(6);
      updateIdeas((prevIdeas) => prevIdeas.filter((idea) => idea.id !== recordingIdea.id));
      clearRecordingContext();
    };
  });

  useEffect(() => {
    return () => {
      try {
        guideMixPlayer.pause();
      } catch {
        // Ignore teardown noise during unmount.
      }
      clearMonitoringDelayTimer();
    };
  }, [guideMixPlayer]);

  // Unmount-only: drop an abandoned empty placeholder idea. Empty deps so it fires solely on
  // screen teardown, not when guideMixPlayer is recreated mid-session.
  useEffect(() => {
    return () => {
      abandonedPlaceholderCleanupRef.current();
    };
  }, []);

  return {
    recordingIdea,
    recordingOverdubClip,
    headerEyebrow,
    headerEyebrowShort,
    headerTitlePlaceholder,
    recordingParentClip,
    latestLyricsVersion,
    latestLyricsText,
    hasProjectLyrics,
    recording,
    recordingControlsDisabled,
    metronomeLockedForTake,
    recordingPlaceholderTitle,
    quickNameModalVisible,
    quickNameDraft,
    isPrimaryDraft,
    settingsVisible,
    metronomeSheetVisible,
    preferredRecordingInputId,
    recordingMetronomeEnabled,
    /**
     * What the tape's ruler draws.
     *
     * Prefers the take's MEASURED grid, and falls back to a preview built from the
     * metronome's current settings the moment it is armed. The reel used to keep drawing
     * decorative second ticks until record was pressed, so the surface only became
     * metronome-shaped at the least welcome moment — and any meter or tempo change made
     * before recording showed nothing at all. Anchored at capture 0 because that is where
     * an idle tape is parked; the spacing is already what the count-in will sound like, so
     * when the measured grid lands only the phase moves.
     */
    liveTakeGrid: liveTakeGrid ?? previewTakeGrid,
    isArmingRecording,
    overdubReviewLocked,
    guideMixIsPlaying: !!guideMixStatus.playing,
    guideMixPositionMs,
    guideJoinInfo,
    guideMixDurationMs,
    guideMixWaveformPeaks,
    isBluetoothRecordingInput,
    isBluetoothMonitoringOutput,
    recordingInputLabel,
    monitoringOutputLabel,
    activeBluetoothCalibrationMs,
    timingWarnings,
    dismissTimingWarning,
    openBluetoothCalibration,
    lyricsExpanded,
    lyricsAutoscrollMode,
    lyricsAutoscrollSpeedMultiplier,
    metronome,
    restoredGridLabel,
    songGrid,
    canEditSongGrid,
    handleSongGridChange,
    canPickSaveDestination,
    saveDestinations,
    saveDestinationPickerVisible,
    saveDestinationOverride,
    effectiveDestinationWorkspaceTitle,
    effectiveDestinationCollectionLabel,
    setSaveDestinationPickerVisible,
    handleSelectSaveDestination,
    setQuickNameDraft,
    setQuickNameModalVisible,
    setIsPrimaryDraft,
    setSettingsVisible,
    setMetronomeSheetVisible,
    setPreferredRecordingInputId,
    setRecordingMetronomeEnabled,
    setMetronomeEnabledForTake,
    toggleMetronomeSound,
    setLyricsExpanded,
    setLyricsAutoscrollMode,
    setLyricsAutoscrollSpeedMultiplier,
    confirmDiscardAndExit,
    confirmRedoTake,
    handleQuickNameCancel,
    minimizeRecording,
    requestSaveRecording,
    saveQuickClipName,
    handlePauseRecording,
    handleResumeRecording,
    handleStartRecording,
  };
}

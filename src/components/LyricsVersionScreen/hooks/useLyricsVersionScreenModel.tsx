import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clipboard,
  Keyboard,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputScrollEventData,
  View,
} from "react-native";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../../../App";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../lyrics";
import { serializeChordChartText } from "../../../chords";
import { haptic } from "../../../design/haptics";
import { useEditHistory } from "../../../hooks/useEditHistory";
import { toast } from "../../common/toastStore";
type LyricsVersionRoute = RootStackParamList["LyricsVersion"];

/** Quiet, humanized "edited" line for the version subtitle — "Edited today",
 * "Edited 3 days ago", "Edited Jun 28" — rather than a raw timestamp. */
function formatVersionEdited(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  if (days < 7) return `Edited ${days} days ago`;
  if (days < 14) return "Edited last week";
  return `Edited ${new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function useLyricsVersionScreenModel() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const {
    ideaId,
    versionId,
    startInEdit = false,
    forceNewVersion = false,
    createDraft = false,
  } = (route.params ?? {}) as LyricsVersionRoute;

  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const workspaces = useStore((state) => state.workspaces);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );
  const projectIdea = useMemo(() => {
    const idea = activeWorkspace?.ideas.find((candidate) => candidate.id === ideaId) ?? null;
    return idea?.kind === "project" ? idea : null;
  }, [activeWorkspace, ideaId]);
  const versions = projectIdea?.lyrics?.versions ?? [];
  const latestVersion = useMemo(() => getLatestLyricsVersion(projectIdea), [projectIdea]);
  const sourceVersion = versionId
    ? versions.find((version) => version.id === versionId) ?? null
    : null;
  const resolvedVersion = sourceVersion ?? latestVersion;
  const isLatestSource = !!resolvedVersion && resolvedVersion.id === latestVersion?.id;
  const sourceText = lyricsDocumentToText(resolvedVersion?.document);
  const sourceVersionNumber = resolvedVersion
    ? versions.findIndex((version) => version.id === resolvedVersion.id) + 1
    : null;

  const [draftText, setDraftText] = useState(sourceText);
  const [baselineText, setBaselineText] = useState(sourceText);
  const [isEditMode, setIsEditMode] = useState(startInEdit || createDraft || !resolvedVersion);
  const [editSavesAsNew, setEditSavesAsNew] = useState(
    forceNewVersion || createDraft || !isLatestSource
  );
  const [editorViewportHeight, setEditorViewportHeight] = useState(0);
  const [editorContentHeight, setEditorContentHeight] = useState(0);
  const [editorScrollY, setEditorScrollY] = useState(0);
  const [previewViewportHeight, setPreviewViewportHeight] = useState(0);
  const [previewContentHeight, setPreviewContentHeight] = useState(0);
  const [previewScrollY, setPreviewScrollY] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const bypassUnsavedGuardRef = useRef(false);

  // In-session undo/redo for draft edits, same engine as the Lyrics Pad editor.
  const draftHistory = useEditHistory(draftText, setDraftText);
  const { reset: resetDraftHistory, schedulePush: pushDraftHistory } = draftHistory;

  const handleDraftTextChange = (text: string) => {
    setDraftText(text);
    pushDraftHistory();
  };

  useEffect(() => {
    setDraftText(sourceText);
    setBaselineText(sourceText);
    setIsEditMode(startInEdit || createDraft || !resolvedVersion);
    setEditSavesAsNew(forceNewVersion || createDraft || !isLatestSource);
    resetDraftHistory(sourceText);
  }, [createDraft, forceNewVersion, isLatestSource, resetDraftHistory, resolvedVersion?.id, sourceText, startInEdit]);

  const hasUnsavedChanges = isEditMode && draftText !== baselineText;
  const canSave = hasUnsavedChanges && (draftText.trim().length > 0 || versions.length > 0);
  const displayedVersionNumber =
    !resolvedVersion || editSavesAsNew ? versions.length + 1 : sourceVersionNumber ?? versions.length + 1;
  const versionLabel = `Version ${displayedVersionNumber}`;
  const versionMeta = !resolvedVersion ? "Unsaved draft" : formatVersionEdited(resolvedVersion.updatedAt);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event: any) => {
      if (bypassUnsavedGuardRef.current || !hasUnsavedChanges) return;
      event.preventDefault();
      AppAlert.destructive("Discard changes?", "You have unsaved lyric edits. Discard them?", () => {
        bypassUnsavedGuardRef.current = true;
        navigation.dispatch(event.data.action);
      }, { confirmLabel: "Discard", icon: actionIcons.discard });
    });
    return unsubscribe;
  }, [hasUnsavedChanges, navigation]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const saveDraft = (asNewOverride?: boolean) => {
    if (!projectIdea || !canSave) return;
    const shouldSaveAsNew = asNewOverride ?? editSavesAsNew;
    haptic.tap();
    if (shouldSaveAsNew) {
      // Base the new version on the version being edited so its chords copy forward.
      appActions.saveProjectLyricsAsNewVersion(projectIdea.id, draftText, resolvedVersion?.document);
    } else {
      appActions.saveProjectLyrics(projectIdea.id, draftText);
    }
    // Land on the saved version's full view (not back at the song). Either path
    // makes the saved version the latest, so clear the params that force edit mode
    // and point at the latest — the effect above then drops us into read mode. No
    // goBack, so the beforeRemove guard isn't involved; the effect resets the
    // baseline, clearing the unsaved flag.
    navigation.setParams({
      versionId: undefined,
      startInEdit: undefined,
      createDraft: undefined,
      forceNewVersion: undefined,
    });
  };

  const copyText = () => {
    // In read mode, copy a chord-over-lyrics chart when the version has chords;
    // otherwise (and while editing) copy the plain lyric text.
    const versionLines = resolvedVersion?.document.lines ?? [];
    const hasChords = versionLines.some((line) => line.chords.length > 0);
    const textToCopy =
      !isEditMode && hasChords ? serializeChordChartText(versionLines) : isEditMode ? draftText : sourceText;
    Clipboard.setString(textToCopy);
    haptic.tap();
    toast(hasChords && !isEditMode ? "Chord chart copied" : "Lyrics copied", "copy-outline");
  };

  const revertDraft = () => {
    setDraftText(sourceText);
    setBaselineText(sourceText);
    if (!resolvedVersion) {
      setDraftText("");
      setBaselineText("");
      resetDraftHistory("");
      return;
    }
    resetDraftHistory(sourceText);
    setIsEditMode(false);
    setEditSavesAsNew(forceNewVersion || !isLatestSource);
  };

  const cancelEdit = () => {
    if (!hasUnsavedChanges) {
      revertDraft();
      return;
    }
    AppAlert.destructive("Discard changes?", "You have unsaved lyric edits. Discard them?", revertDraft, { confirmLabel: "Discard", cancelLabel: "Keep editing", icon: actionIcons.discard });
  };

  const renderScrollIndicator = (viewportHeight: number, contentHeight: number, scrollY: number) => {
    if (viewportHeight <= 0 || contentHeight <= viewportHeight + 1) return null;
    const trackHeight = Math.max(viewportHeight - 8, 24);
    const thumbHeight = Math.max(28, (viewportHeight * viewportHeight) / contentHeight);
    const maxScroll = Math.max(contentHeight - viewportHeight, 1);
    const maxThumbTravel = Math.max(trackHeight - thumbHeight, 0);
    const thumbTop = (Math.min(scrollY, maxScroll) / maxScroll) * maxThumbTravel;

    return (
      <View style={[styles.lyricsScrollIndicatorTrack, { height: trackHeight }]}>
        <View
          style={[
            styles.lyricsScrollIndicatorThumb,
            { height: thumbHeight, transform: [{ translateY: thumbTop }] },
          ]}
        />
      </View>
    );
  };

  const beginEdit = () => {
    haptic.tap();
    setIsEditMode(true);
    setEditSavesAsNew(!isLatestSource || forceNewVersion);
  };

  const beginNewDraft = () => {
    haptic.tap();
    setIsEditMode(true);
    setEditSavesAsNew(true);
  };

  const handleEditorContentSize = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    setEditorContentHeight(event.nativeEvent.contentSize.height + 24);
  };

  const handleEditorScroll = (event: NativeSyntheticEvent<TextInputScrollEventData>) => {
    setEditorScrollY(event.nativeEvent.contentOffset.y);
  };

  return {
    projectIdea,
    versionLabel,
    versionMeta,
    isEditMode,
    canSave,
    editSavesAsNew,
    isLatestSource,
    resolvedVersion,
    draftText,
    setDraftText,
    handleDraftTextChange,
    canUndoDraft: draftHistory.canUndo,
    canRedoDraft: draftHistory.canRedo,
    undoDraft: draftHistory.undo,
    redoDraft: draftHistory.redo,
    sourceText,
    isKeyboardVisible,
    bottomInset: insets.bottom,
    topInset: insets.top,
    editorViewportHeight,
    setEditorViewportHeight,
    editorContentHeight,
    editorScrollY,
    previewViewportHeight,
    setPreviewViewportHeight,
    previewContentHeight,
    setPreviewContentHeight,
    previewScrollY,
    setPreviewScrollY,
    saveDraft,
    copyText,
    cancelEdit,
    beginEdit,
    beginNewDraft,
    renderScrollIndicator,
    handleEditorContentSize,
    handleEditorScroll,
  };
}

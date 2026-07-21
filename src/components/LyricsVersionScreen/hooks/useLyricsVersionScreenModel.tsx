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
import type { RootStackParamList } from "../../../navigation";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../domain/lyrics";
import { serializeChordChartText } from "../../../domain/chords";
import { haptic } from "../../../design/haptics";
import { useEditHistory } from "../../../hooks/useEditHistory";
import { toast } from "../../common/toastStore";
import type { ContentDirection } from "../../../types";
import { useTranslation } from "react-i18next";
import { useLocale } from "../../../i18n";
type LyricsVersionRoute = RootStackParamList["LyricsVersion"];

/** Quiet, humanized "edited" line for the version subtitle — "Edited today",
 * "Edited 3 days ago", "Edited Jun 28" — rather than a raw timestamp. */
function formatVersionEdited(ts: number, locale: string, t: (key: string, options?: any) => string): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return t("lyrics.editedToday");
  if (days === 1) return t("lyrics.editedYesterday");
  if (days < 7) return t("lyrics.editedDaysAgo", { count: days });
  if (days < 14) return t("lyrics.editedLastWeek");
  return t("lyrics.editedDate", { date: new Date(ts).toLocaleDateString(locale, { month: "short", day: "numeric" }) });
}

export function useLyricsVersionScreenModel() {
  const { t } = useTranslation();
  const { formatLocale } = useLocale();
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
  const sourceDirection: ContentDirection = resolvedVersion?.textDirection ?? "auto";
  const [textDirection, setTextDirection] = useState<ContentDirection>(sourceDirection);
  const [baselineDirection, setBaselineDirection] = useState<ContentDirection>(sourceDirection);
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
    setTextDirection(sourceDirection);
    setBaselineDirection(sourceDirection);
    setIsEditMode(startInEdit || createDraft || !resolvedVersion);
    setEditSavesAsNew(forceNewVersion || createDraft || !isLatestSource);
    resetDraftHistory(sourceText);
  }, [createDraft, forceNewVersion, isLatestSource, resetDraftHistory, resolvedVersion?.id, sourceDirection, sourceText, startInEdit]);

  const hasUnsavedChanges = isEditMode && (draftText !== baselineText || textDirection !== baselineDirection);
  const canSave = hasUnsavedChanges && (draftText.trim().length > 0 || versions.length > 0);
  const displayedVersionNumber =
    !resolvedVersion || editSavesAsNew ? versions.length + 1 : sourceVersionNumber ?? versions.length + 1;
  const versionLabel = t("lyrics.version", { number: displayedVersionNumber });
  const versionMeta = !resolvedVersion ? t("lyrics.unsavedDraft") : formatVersionEdited(resolvedVersion.updatedAt, formatLocale, t);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event: any) => {
      if (bypassUnsavedGuardRef.current || !hasUnsavedChanges) return;
      event.preventDefault();
      AppAlert.destructive(t("lyrics.discardTitle"), t("lyrics.discardBody"), () => {
        bypassUnsavedGuardRef.current = true;
        navigation.dispatch(event.data.action);
      }, { confirmLabel: t("lyrics.discard"), icon: actionIcons.discard });
    });
    return unsubscribe;
  }, [hasUnsavedChanges, navigation, t]);

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
      appActions.saveProjectLyricsAsNewVersion(projectIdea.id, draftText, resolvedVersion?.document, textDirection);
    } else {
      appActions.saveProjectLyrics(projectIdea.id, draftText, textDirection);
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
    toast(t(hasChords && !isEditMode ? "lyrics.chartCopied" : "lyrics.lyricsCopied"), "copy-outline");
  };

  const revertDraft = () => {
    setDraftText(sourceText);
    setBaselineText(sourceText);
    setTextDirection(sourceDirection);
    setBaselineDirection(sourceDirection);
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
    AppAlert.destructive(t("lyrics.discardTitle"), t("lyrics.discardBody"), revertDraft, { confirmLabel: t("lyrics.discard"), cancelLabel: t("lyrics.keepEditing"), icon: actionIcons.discard });
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
    textDirection,
    setTextDirection,
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

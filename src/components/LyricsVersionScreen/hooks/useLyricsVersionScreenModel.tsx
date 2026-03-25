import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Clipboard,
  Keyboard,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputScrollEventData,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { AppBreadcrumbItem } from "../../common/AppBreadcrumbs";
import type { RootStackParamList } from "../../../../App";
import { styles } from "../styles";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../lyrics";
import { formatDate, getCollectionAncestors, getCollectionById } from "../../../utils";
import { getCollectionHierarchyLevel } from "../../../hierarchy";
import { openCollectionFromContext } from "../../../navigation";

type LyricsVersionRoute = RootStackParamList["LyricsVersion"];

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

  useEffect(() => {
    setDraftText(sourceText);
    setBaselineText(sourceText);
    setIsEditMode(startInEdit || createDraft || !resolvedVersion);
    setEditSavesAsNew(forceNewVersion || createDraft || !isLatestSource);
  }, [createDraft, forceNewVersion, isLatestSource, resolvedVersion?.id, sourceText, startInEdit]);

  const hasUnsavedChanges = isEditMode && draftText !== baselineText;
  const canSave = hasUnsavedChanges && (draftText.trim().length > 0 || versions.length > 0);
  const displayedVersionNumber =
    !resolvedVersion || editSavesAsNew ? versions.length + 1 : sourceVersionNumber ?? versions.length + 1;
  const versionLabel = `Version ${displayedVersionNumber}`;
  const versionMeta = !resolvedVersion ? "Unsaved draft" : formatDate(resolvedVersion.updatedAt);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event: any) => {
      if (bypassUnsavedGuardRef.current || !hasUnsavedChanges) return;
      event.preventDefault();
      Alert.alert("Discard changes?", "You have unsaved lyric edits. Discard them?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            bypassUnsavedGuardRef.current = true;
            navigation.dispatch(event.data.action);
          },
        },
      ]);
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

  const projectCollection = useMemo(
    () => (activeWorkspace && projectIdea ? getCollectionById(activeWorkspace, projectIdea.collectionId) : null),
    [activeWorkspace, projectIdea]
  );
  const projectCollectionAncestors = useMemo(
    () =>
      activeWorkspace && projectCollection
        ? getCollectionAncestors(activeWorkspace, projectCollection.id)
        : [],
    [activeWorkspace, projectCollection]
  );

  const breadcrumbItems = useMemo<AppBreadcrumbItem[]>(() => {
    if (!activeWorkspace || !projectCollection || !projectIdea) return [];

    return [
      {
        key: "home",
        label: "Home",
        level: "home",
        iconOnly: true,
        onPress: () => navigation.navigate("Home", { screen: "Workspaces" }),
      },
      {
        key: `workspace-${activeWorkspace.id}`,
        label: activeWorkspace.title,
        level: "workspace",
        onPress: () => navigation.navigate("Home", { screen: "Browse" }),
      },
      ...projectCollectionAncestors.map((collection) => ({
        key: collection.id,
        label: collection.title,
        level: getCollectionHierarchyLevel(collection),
        onPress: () =>
          openCollectionFromContext(navigation, {
            collectionId: collection.id,
            source: "detail" as const,
          }),
      })),
      {
        key: projectCollection.id,
        label: projectCollection.title,
        level: getCollectionHierarchyLevel(projectCollection),
        onPress: () =>
          openCollectionFromContext(navigation, {
            collectionId: projectCollection.id,
            source: "detail",
          }),
      },
      {
        key: projectIdea.id,
        label: projectIdea.title,
        level: "song",
        onPress: () => navigation.navigate("IdeaDetail", { ideaId: projectIdea.id }),
      },
      {
        key: "lyrics",
        label: "Lyrics",
        level: "lyrics",
        active: true,
      },
    ];
  }, [activeWorkspace, navigation, projectCollection, projectCollectionAncestors, projectIdea]);

  const saveDraft = (asNewOverride?: boolean) => {
    if (!projectIdea || !canSave) return;
    const shouldSaveAsNew = asNewOverride ?? editSavesAsNew;
    void Haptics.selectionAsync();
    if (shouldSaveAsNew) {
      appActions.saveProjectLyricsAsNewVersion(projectIdea.id, draftText);
    } else {
      appActions.saveProjectLyrics(projectIdea.id, draftText);
    }
    bypassUnsavedGuardRef.current = true;
    navigation.goBack();
  };

  const copyText = () => {
    const textToCopy = isEditMode ? draftText : sourceText;
    Clipboard.setString(textToCopy);
    void Haptics.selectionAsync();
    Alert.alert("Copied", "Lyrics text copied to your clipboard.");
  };

  const revertDraft = () => {
    setDraftText(sourceText);
    setBaselineText(sourceText);
    if (!resolvedVersion) {
      setDraftText("");
      setBaselineText("");
      return;
    }
    setIsEditMode(false);
    setEditSavesAsNew(forceNewVersion || !isLatestSource);
  };

  const cancelEdit = () => {
    if (!hasUnsavedChanges) {
      revertDraft();
      return;
    }
    Alert.alert("Discard changes?", "You have unsaved lyric edits. Discard them?", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: revertDraft,
      },
    ]);
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
    void Haptics.selectionAsync();
    setIsEditMode(true);
    setEditSavesAsNew(!isLatestSource || forceNewVersion);
  };

  const beginNewDraft = () => {
    void Haptics.selectionAsync();
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
    breadcrumbItems,
    versionLabel,
    versionMeta,
    isEditMode,
    canSave,
    editSavesAsNew,
    isLatestSource,
    resolvedVersion,
    draftText,
    setDraftText,
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

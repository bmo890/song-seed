import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Clipboard, Keyboard, KeyboardAvoidingView, NativeSyntheticEvent, ScrollView, Text, TextInput, TextInputContentSizeChangeEventData, TextInputScrollEventData, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import type { RootStackParamList } from "../../../App";
import { styles } from "../../styles";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { Button } from "../common/Button";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../lyrics";
import { formatDate } from "../../utils";
import { getCollectionAncestors, getCollectionById } from "../../utils";
import { getCollectionHierarchyLevel } from "../../hierarchy";
import { openCollectionFromContext } from "../../navigation";

type LyricsVersionRoute = RouteProp<RootStackParamList, "LyricsVersion">;

export function LyricsVersionScreen() {
  const navigation = useNavigation();
  const route = useRoute<LyricsVersionRoute>();
  const { ideaId, versionId, startInEdit = false, forceNewVersion = false, createDraft = false } = route.params;
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const insets = useSafeAreaInsets();

  const selectedIdea = useStore((s) => {
    const workspace = s.workspaces.find((item) => item.id === activeWorkspaceId);
    return workspace?.ideas.find((idea) => idea.id === ideaId) ?? null;
  });
  const activeWorkspace = useStore((s) => s.workspaces.find((item) => item.id === activeWorkspaceId) ?? null);

  const versions = selectedIdea?.kind === "project" ? selectedIdea.lyrics?.versions ?? [] : [];
  const latestVersion = useMemo(() => getLatestLyricsVersion(selectedIdea), [selectedIdea]);
  const sourceVersion = versionId ? versions.find((version) => version.id === versionId) ?? null : null;
  const resolvedVersion = sourceVersion ?? latestVersion;
  const isLatestSource = !!resolvedVersion && resolvedVersion.id === latestVersion?.id;
  const sourceText = lyricsDocumentToText(resolvedVersion?.document);
  const sourceVersionNumber = resolvedVersion ? versions.findIndex((version) => version.id === resolvedVersion.id) + 1 : null;

  const [draftText, setDraftText] = useState(sourceText);
  const [baselineText, setBaselineText] = useState(sourceText);
  const [isEditMode, setIsEditMode] = useState(startInEdit || createDraft || !resolvedVersion);
  const [editSavesAsNew, setEditSavesAsNew] = useState(forceNewVersion || createDraft || !isLatestSource);
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
      if (bypassUnsavedGuardRef.current) return;
      if (!hasUnsavedChanges) return;
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

  if (!selectedIdea || selectedIdea.kind !== "project") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <ScreenHeader title="Lyrics Version" leftIcon="back" />
        <Text style={styles.emptyText}>This lyrics version is no longer available.</Text>
        <ExpoStatusBar style="dark" />
      </SafeAreaView>
    );
  }

  const projectIdea = selectedIdea;
  const projectCollection =
    activeWorkspace ? getCollectionById(activeWorkspace, projectIdea.collectionId) : null;
  const projectCollectionAncestors =
    projectCollection && activeWorkspace ? getCollectionAncestors(activeWorkspace, projectCollection.id) : [];

  function saveDraft(asNewOverride?: boolean) {
    const shouldSaveAsNew = asNewOverride ?? editSavesAsNew;
    if (!canSave) return;
    void Haptics.selectionAsync();
    if (shouldSaveAsNew) {
      appActions.saveProjectLyricsAsNewVersion(projectIdea.id, draftText);
    } else {
      appActions.saveProjectLyrics(projectIdea.id, draftText);
    }
    bypassUnsavedGuardRef.current = true;
    navigation.goBack();
  }

  function copyText() {
    const textToCopy = isEditMode ? draftText : sourceText;
    Clipboard.setString(textToCopy);
    void Haptics.selectionAsync();
    Alert.alert("Copied", "Lyrics text copied to your clipboard.");
  }

  function revertDraft() {
    setDraftText(sourceText);
    setBaselineText(sourceText);
    if (!resolvedVersion) {
      setDraftText("");
      setBaselineText("");
      return;
    }
    setIsEditMode(false);
    setEditSavesAsNew(forceNewVersion || !isLatestSource);
  }

  function cancelEdit() {
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
  }

  function renderScrollIndicator(viewportHeight: number, contentHeight: number, scrollY: number) {
    if (viewportHeight <= 0 || contentHeight <= viewportHeight + 1) return null;
    const trackHeight = Math.max(viewportHeight - 8, 24);
    const thumbHeight = Math.max(28, (viewportHeight * viewportHeight) / contentHeight);
    const maxScroll = Math.max(contentHeight - viewportHeight, 1);
    const maxThumbTravel = Math.max(trackHeight - thumbHeight, 0);
    const thumbTop = (Math.min(scrollY, maxScroll) / maxScroll) * maxThumbTravel;

    return (
      <View style={[styles.lyricsScrollIndicatorTrack, { height: trackHeight }]}>
        <View style={[styles.lyricsScrollIndicatorThumb, { height: thumbHeight, transform: [{ translateY: thumbTop }] }]} />
      </View>
    );
  }

  function handleEditorContentSize(event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) {
    setEditorContentHeight(event.nativeEvent.contentSize.height + 24);
  }

  function handleEditorScroll(event: NativeSyntheticEvent<TextInputScrollEventData>) {
    setEditorScrollY(event.nativeEvent.contentOffset.y);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={versionLabel}
        leftIcon="back"
      />

      {activeWorkspace && projectCollection ? (
        <AppBreadcrumbs
          items={[
            {
              key: "home",
              label: "Home",
              level: "home",
              iconOnly: true,
              onPress: () => (navigation as any).navigate("Home", { screen: "Workspaces" }),
            },
            {
              key: `workspace-${activeWorkspace.id}`,
              label: activeWorkspace.title,
              level: "workspace",
              onPress: () => (navigation as any).navigate("Home", { screen: "Browse" }),
            },
            ...projectCollectionAncestors.map((collection) => ({
              key: collection.id,
              label: collection.title,
              level: getCollectionHierarchyLevel(collection),
              onPress: () =>
                openCollectionFromContext(navigation, {
                  collectionId: collection.id,
                  source: "detail",
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
              onPress: () => (navigation as any).navigate("IdeaDetail", { ideaId: projectIdea.id }),
            },
            {
              key: "lyrics",
              label: "Lyrics",
              level: "lyrics",
              active: true,
            },
          ]}
        />
      ) : null}

      <Text style={styles.subtitle}>{versionMeta}</Text>

      <KeyboardAvoidingView
        style={[styles.flexFill, { paddingBottom: isKeyboardVisible ? 0 : insets.bottom }]}
        behavior="height"
        keyboardVerticalOffset={insets.top}
      >
      {isEditMode ? (
      <View style={styles.flexFill}>
        <View style={styles.lyricsVersionTopActions}>
          <Button
            label={editSavesAsNew ? "Save New" : "Save"}
            disabled={!canSave}
            onPress={() => saveDraft()}
            style={styles.lyricsActionBtn}
            textStyle={styles.lyricsActionBtnText}
          />
          {resolvedVersion && isLatestSource && !editSavesAsNew ? (
            <Button
              variant="secondary"
              label="Save as New"
              disabled={!canSave}
              onPress={() => saveDraft(true)}
              style={styles.lyricsActionBtn}
              textStyle={styles.lyricsActionBtnText}
            />
          ) : null}
          <Button
            variant="secondary"
            label="Cancel"
            onPress={cancelEdit}
            style={styles.lyricsActionBtn}
            textStyle={styles.lyricsActionBtnText}
          />
        </View>
        <View style={[styles.lyricsVersionDocumentFill, styles.lyricsVersionDocumentFillEdit]}>
          <View style={[styles.lyricsVersionDocumentContent, styles.lyricsVersionDocumentContentEdit]}>
            <View
              style={styles.lyricsScrollableWrap}
              onLayout={(event) => setEditorViewportHeight(event.nativeEvent.layout.height)}
            >
              <TextInput
                style={[styles.lyricsInput, styles.lyricsInputFill, styles.lyricsEditFieldActive]}
                multiline
                placeholder="Write your lyrics here"
                value={draftText}
                onChangeText={setDraftText}
                textAlignVertical="top"
                scrollEnabled
                onContentSizeChange={handleEditorContentSize}
                onScroll={handleEditorScroll}
              />
              {renderScrollIndicator(editorViewportHeight, editorContentHeight, editorScrollY)}
            </View>
          </View>
        </View>
      </View>
      ) : (
      <View style={styles.lyricsVersionScreenBody}>
        <View style={styles.lyricsVersionTopActions}>
          <Button
            label={isLatestSource ? "Edit" : "Edit as New"}
            onPress={() => {
              void Haptics.selectionAsync();
              setIsEditMode(true);
              setEditSavesAsNew(!isLatestSource || forceNewVersion);
            }}
            style={styles.lyricsActionBtn}
            textStyle={styles.lyricsActionBtnText}
          />
          {isLatestSource ? (
            <Button
              variant="secondary"
              label="New Draft"
              onPress={() => {
                void Haptics.selectionAsync();
                setIsEditMode(true);
                setEditSavesAsNew(true);
              }}
              style={styles.lyricsActionBtn}
              textStyle={styles.lyricsActionBtnText}
            />
          ) : null}
          <Button
            variant="secondary"
            label="Copy"
            onPress={copyText}
            style={styles.lyricsActionBtn}
            textStyle={styles.lyricsActionBtnText}
          />
        </View>
        <View style={styles.lyricsVersionDocumentFill}>
          <View
            style={[styles.lyricsPreviewWrap, styles.lyricsPreviewWrapExpanded, styles.lyricsPreviewWrapDocument, styles.lyricsScrollableWrap]}
            onLayout={(event) => setPreviewViewportHeight(event.nativeEvent.layout.height)}
          >
            <ScrollView
              style={styles.flexFill}
              contentContainerStyle={styles.lyricsVersionPreviewContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(_, height) => setPreviewContentHeight(height)}
              onScroll={(event) => setPreviewScrollY(event.nativeEvent.contentOffset.y)}
              scrollEventThrottle={16}
            >
              <Text style={styles.lyricsPreviewText}>{sourceText || "No lyrics in this version."}</Text>
            </ScrollView>
            {renderScrollIndicator(previewViewportHeight, previewContentHeight, previewScrollY)}
          </View>
        </View>
      </View>
      )}
      </KeyboardAvoidingView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

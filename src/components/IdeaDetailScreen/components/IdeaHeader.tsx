import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "../styles";
import { appActions } from "../../../state/actions";
import { TitleInput } from "../../common/TitleInput";
import { useSongScreen } from "../provider/SongScreenProvider";

export function IdeaHeader() {
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const { screen, editFlow, actions } = useSongScreen();

  const selectedIdea = screen.selectedIdea;

  if (!selectedIdea) return null;

  const isEditMode = screen.isEditMode;
  const compactTitleMode = screen.songTab === "takes" && screen.isIdeasSticky;
  const playAllDisabled = !screen.isProject || actions.buildProjectQueue().length === 0;
  const isNewProjectDraft = selectedIdea.isDraft;
  const titleLabel = selectedIdea.kind === "project" ? "Song" : "Clip";
  const isProject = selectedIdea.kind === "project";
  const showCompactTitle = compactTitleMode && !isEditMode;

  const progress = useSharedValue(showCompactTitle ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(showCompactTitle ? 1 : 0, { duration: 180 });
  }, [progress, showCompactTitle]);

  const compactTitleAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1]),
  }));

  return (
    <View style={styles.songDetailHeader}>
      {/* Nav row: chevron back | (spacer or compact title) | ellipsis/edit actions */}
      <View style={styles.songDetailNavRow}>
        <Pressable
          style={({ pressed }) => [
            {
              minHeight: 36,
              alignItems: "flex-start" as const,
              justifyContent: "center" as const,
              paddingRight: 12,
            },
            pressed ? styles.pressDown : null,
          ]}
          onPress={actions.handleBackToIdeas}
        >
          <Ionicons name="chevron-back" size={24} color="#524440" />
        </Pressable>

        {/* Center: empty spacer in default mode; compact title when sticky */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Animated.View
            style={[styles.songDetailCompactTitleWrap, compactTitleAnimStyle]}
            pointerEvents={showCompactTitle ? "auto" : "none"}
          >
            <Text style={styles.songDetailNavCompactTitle} numberOfLines={1}>
              {selectedIdea.title}
            </Text>
          </Animated.View>
        </View>

        {isEditMode ? (
          <View style={styles.songDetailNavEditActions}>
            <Pressable
              style={({ pressed }) => [
                styles.songDetailNavTextAction,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => {
                void Haptics.selectionAsync();
                editFlow.handleCancel();
              }}
            >
              <Text style={styles.songDetailNavTextActionText}>
                {selectedIdea.isDraft ? "Discard" : "Cancel"}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.songDetailNavTextAction,
                styles.songDetailNavTextActionPrimary,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => {
                void Haptics.selectionAsync();
                editFlow.handleSave();
              }}
            >
              <Text style={styles.songDetailNavTextActionPrimaryText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.ideasHeaderMenuBtn, pressed ? styles.pressDown : null]}
            onPress={() => setHeaderMenuOpen((prev) => !prev)}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color="#524440" />
          </Pressable>
        )}
      </View>

      {/* Title block — hidden in compact mode */}
      {!showCompactTitle ? (
      <View style={styles.songDetailTitleBlock}>
        {isEditMode ? (
          <>
            <Text style={styles.songDetailTypeLabel}>Editing {titleLabel}</Text>
            <TitleInput
              value={screen.draftTitle}
              onChangeText={screen.setDraftTitle}
              placeholder={`${isProject ? "Song" : "Clip"} title`}
              containerStyle={styles.songDetailTitleInputWrap}
              minHeight={40}
              maxHeight={92}
              showGenerator={false}
            />
          </>
        ) : (
          <>
            <Text style={styles.songDetailTypeEyebrow}>{titleLabel}</Text>
            <Text style={styles.songDetailPageTitleLarge}>
              {selectedIdea.title}
            </Text>
            {isProject ? (
              <View style={styles.songDetailProgressStrip}>
                <Text style={styles.songDetailProgressStripLabel}>Progress</Text>
                <Text style={styles.songDetailProgressStripPercent}>
                  {selectedIdea.completionPct}%
                </Text>
                <Text
                  style={
                    selectedIdea.status === "song"
                      ? [styles.badge, styles.statusSong, styles.statusSongText]
                      : selectedIdea.status === "semi"
                        ? [styles.badge, styles.statusSemi, styles.statusSemiText]
                        : selectedIdea.status === "sprout"
                          ? [styles.badge, styles.statusSprout, styles.statusSproutText]
                          : [styles.badge, styles.statusSeed, styles.statusSeedText]
                  }
                >
                  {selectedIdea.status === "song" ? "SONG" : selectedIdea.status.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
      ) : null}

      {/* Overflow menu */}
      {headerMenuOpen ? (
        <View style={styles.ideasHeaderMenuLayer} pointerEvents="box-none">
          <Pressable
            style={styles.ideasHeaderMenuBackdrop}
            onPress={() => setHeaderMenuOpen(false)}
          />
          <View style={[styles.ideasSortMenu, styles.ideasHeaderOverflowMenu]}>
            <Pressable
              style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
              onPress={() => {
                setHeaderMenuOpen(false);
                void Haptics.selectionAsync();
                screen.setIsEditMode(true);
              }}
            >
              <Text style={styles.ideasSortMenuItemText}>
                {isProject ? "Edit song" : "Edit clip"}
              </Text>
              <Ionicons name="create-outline" size={15} color="#524440" />
            </Pressable>
            {isProject ? (
              <>
                <View style={styles.ideasDropdownDivider} />
                <Pressable
                  style={({ pressed }) => [
                    styles.ideasToggleRow,
                    playAllDisabled ? styles.btnDisabled : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  disabled={playAllDisabled}
                  onPress={() => {
                    setHeaderMenuOpen(false);
                    void Haptics.selectionAsync();
                    actions.playProjectQueue();
                  }}
                >
                  <Text style={styles.ideasSortMenuItemText}>Play all</Text>
                  <Ionicons name="play-outline" size={15} color="#524440" />
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.ideasDropdownDivider} />
                <Pressable
                  style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                  onPress={() => {
                    setHeaderMenuOpen(false);
                    void Haptics.selectionAsync();
                    appActions.convertSelectedClipIdeaToProject();
                  }}
                >
                  <Text style={styles.ideasSortMenuItemText}>Make song</Text>
                  <Ionicons name="albums-outline" size={15} color="#524440" />
                </Pressable>
              </>
            )}
            {!isNewProjectDraft ? (
              <>
                <View style={styles.ideasDropdownDivider} />
                <Pressable
                  style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                  onPress={() => {
                    setHeaderMenuOpen(false);
                    Alert.alert(
                      isProject ? "Delete song?" : "Delete clip?",
                      isProject
                        ? `Delete "${selectedIdea.title}" and all its clips?`
                        : `Delete "${selectedIdea.title}"?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => {
                            appActions.deleteSelectedIdea();
                            screen.navigation.goBack();
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.songDetailDangerMenuText}>
                    {isProject ? "Delete song" : "Delete clip"}
                  </Text>
                  <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

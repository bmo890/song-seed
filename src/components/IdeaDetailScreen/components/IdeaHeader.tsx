import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "../styles";
import { appActions } from "../../../state/actions";
import { TitleInput } from "../../common/TitleInput";
import { useSongScreen } from "../provider/SongScreenProvider";
import { COMPACT_TITLE_FADE_IN_END, COMPACT_TITLE_FADE_IN_START } from "../headerCollapse";
import { AppAlert } from "../../common/AppAlert";
import { useStore } from "../../../state/useStore";

export function IdeaHeader() {
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const { screen, editFlow, actions } = useSongScreen();
  // While clips are selected, the bottom bar already offers a clip "Delete". Disable
  // the song-level delete here so it can't be tapped by mistake mid-selection.
  const isSelectingClips = useStore((s) => s.selectedClipIds.length > 0);

  const selectedIdea = screen.selectedIdea;

  if (!selectedIdea) return null;

  const isEditMode = screen.isEditMode;
  const playAllDisabled = !screen.isProject || actions.buildProjectQueue().length === 0;
  const isNewProjectDraft = selectedIdea.isDraft;
  const titleLabel = selectedIdea.kind === "project" ? "Song" : "Clip";
  const isProject = selectedIdea.kind === "project";
  const scrollY = screen.scrollY;
  const collapsibleHeaderHeight = screen.collapsibleHeaderHeight;

  // Compact title fades in as the large title (top of the overlay) slides up and
  // out — keyed to a fixed px window matching the title-block height so neither
  // title is ever missing during the transition.
  const compactTitleAnimStyle = useAnimatedStyle(() => {
    if (isEditMode || collapsibleHeaderHeight.value <= 0) return { opacity: 0 };
    return {
      opacity: interpolate(
        scrollY.value,
        [COMPACT_TITLE_FADE_IN_START, COMPACT_TITLE_FADE_IN_END],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

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

        {/* Center: empty spacer in default mode; compact title fades in on scroll */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Animated.View
            style={[styles.songDetailCompactTitleWrap, compactTitleAnimStyle]}
            pointerEvents="none"
          >
            <Text style={styles.songDetailNavCompactTitle} numberOfLines={1}>
              {selectedIdea.title}
            </Text>
          </Animated.View>
        </View>

        {isEditMode && !isProject ? (
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

      {/* Clips edit their title inline under the nav. Songs use the edit sheet,
          so their title block stays in the collapsing overlay. */}
      {isEditMode && !isProject ? (
        <View style={styles.songDetailTitleBlock}>
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
                  style={({ pressed }) => [
                    styles.ideasToggleRow,
                    isSelectingClips ? styles.btnDisabled : null,
                    pressed && !isSelectingClips ? styles.pressDown : null,
                  ]}
                  disabled={isSelectingClips}
                  onPress={() => {
                    setHeaderMenuOpen(false);
                    AppAlert.destructive(
                      isProject ? "Delete song?" : "Delete clip?",
                      isProject
                        ? `Delete "${selectedIdea.title}" and all its clips?`
                        : `Delete "${selectedIdea.title}"?`,
                      () => {
                        appActions.deleteSelectedIdea();
                        screen.navigation.goBack();
                      },
                      { confirmLabel: "Delete" }
                    );
                  }}
                >
                  <Text style={isSelectingClips ? styles.ideasSortMenuItemText : styles.songDetailDangerMenuText}>
                    {isProject ? "Delete song" : "Delete clip"}
                  </Text>
                  <Ionicons name="trash-outline" size={15} color={isSelectingClips ? "#a89a96" : "#b91c1c"} />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

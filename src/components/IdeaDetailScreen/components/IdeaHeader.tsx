import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { styles } from "../styles";
import { appActions } from "../../../state/actions";
import { TitleInput } from "../../common/TitleInput";
import { IconButton } from "../../common/IconButton";
import { useSongScreen } from "../provider/SongScreenProvider";
import { COMPACT_TITLE_FADE_IN_END, COMPACT_TITLE_FADE_IN_START } from "../headerCollapse";
import { AppAlert } from "../../common/AppAlert";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";
import { useShallow } from "zustand/react/shallow";

export function IdeaHeader() {
  const { t } = useTranslation();
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const { screen, editFlow, actions, importFlow } = useSongScreen();
  // While clips are selected, the bottom bar already offers a clip "Delete". Disable
  // the song-level delete here so it can't be tapped by mistake mid-selection.
  const isSelectingClips = useStore((s) => s.selectedClipIds.length > 0);

  const selectedIdea = screen.selectedIdea;
  // WHERE · WHAT: the back button is labelled with the collection this idea lives
  // in and the page's type, so the hierarchy reads in one row (2026-09-07).
  const collectionTitle = useStore(
    useShallow((s) => {
      const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
      return ws?.collections.find((c) => c.id === selectedIdea?.collectionId)?.title ?? null;
    })
  );

  if (!selectedIdea) return null;

  const isEditMode = screen.isEditMode;
  const playAllDisabled = !screen.isProject || actions.buildProjectQueue().length === 0;
  const isNewProjectDraft = selectedIdea.isDraft;
  const titleLabel = selectedIdea.kind === "project" ? t("songDetail.song") : t("songDetail.clip");
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
  // The eyebrow label yields its slot to the compact title as the big title
  // scrolls away — one of them is always readable, never both.
  const eyebrowAnimStyle = useAnimatedStyle(() => {
    if (isEditMode || collapsibleHeaderHeight.value <= 0) return { opacity: 1 };
    return {
      opacity: interpolate(
        scrollY.value,
        [COMPACT_TITLE_FADE_IN_START, COMPACT_TITLE_FADE_IN_END],
        [1, 0],
        Extrapolation.CLAMP
      ),
    };
  });
  // The back button is labelled with the container this idea lives in — the
  // collection — and nothing else: the page's own type is the page you are on.
  const eyebrowText = collectionTitle ?? "";

  return (
    <View style={styles.songDetailHeader}>
      {/* Nav row: chevron back | (spacer or compact title) | ellipsis/edit actions */}
      <View style={styles.songDetailNavRow}>
        <Pressable
          testID="song-header-back"
          accessibilityRole="button"
          accessibilityLabel={collectionTitle ? t("common.backTo", { label: collectionTitle }) : t("common.back")}
          style={({ pressed }) => [styles.songDetailNavLead, pressed ? styles.pressDown : null]}
          onPress={actions.handleBackToIdeas}
          hitSlop={8}
        >
          <Ionicons name={dirIcon("chevron-back")} size={22} color={colors.textStrong} />
          {/* One slot, two occupants: the WHERE · WHAT label while the big title is
              on screen, the compact title once it has scrolled away. */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Animated.View style={[styles.songDetailNavEyebrowWrap, eyebrowAnimStyle]} pointerEvents="none">
              <Text style={styles.songDetailNavEyebrow} numberOfLines={1}>
                {eyebrowText}
              </Text>
            </Animated.View>
            <Animated.View
              style={[styles.songDetailCompactTitleWrap, styles.songDetailNavSlotOverlay, compactTitleAnimStyle]}
              pointerEvents="none"
            >
              <UserText value={selectedIdea.title} style={styles.songDetailNavCompactTitle} numberOfLines={1}>
                {selectedIdea.title}
              </UserText>
            </Animated.View>
          </View>
        </Pressable>

        {isEditMode && !isProject ? (
          <View style={styles.songDetailNavEditActions}>
            <Pressable
              style={({ pressed }) => [
                styles.songDetailNavTextAction,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => {
                haptic.tap();
                editFlow.handleCancel();
              }}
            >
              <Text style={styles.songDetailNavTextActionText}>
                {selectedIdea.isDraft ? t("songDetail.discard") : t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.songDetailNavTextAction,
                styles.songDetailNavTextActionPrimary,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => {
                haptic.tap();
                editFlow.handleSave();
              }}
            >
              <Text style={styles.songDetailNavTextActionPrimaryText}>{t("common.save")}</Text>
            </Pressable>
          </View>
        ) : (
          <IconButton
            icon="ellipsis-horizontal"
            tone="muted"
            size={20}
            onPress={() => setHeaderMenuOpen((prev) => !prev)}
            accessibilityLabel={t("common.moreOptions")}
          />
        )}
      </View>

      {/* Clips edit their title inline under the nav. Songs use the edit sheet,
          so their title block stays in the collapsing overlay. */}
      {isEditMode && !isProject ? (
        <View style={styles.songDetailTitleBlock}>
          <Text style={styles.songDetailTypeLabel}>{t("songDetail.editing", { type: titleLabel })}</Text>
          <TitleInput
            value={screen.draftTitle}
            onChangeText={screen.setDraftTitle}
            placeholder={isProject ? t("songDetail.songTitle") : t("songDetail.clipTitle")}
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
                haptic.tap();
                screen.setIsEditMode(true);
              }}
            >
              <Text style={styles.ideasSortMenuItemText}>
                {isProject ? t("songDetail.editSong") : t("songDetail.editClip")}
              </Text>
              <Ionicons name="create-outline" size={15} color={colors.textStrong} />
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
                    haptic.tap();
                    actions.playProjectQueue();
                  }}
                >
                  <Text style={styles.ideasSortMenuItemText}>{t("songDetail.playAll")}</Text>
                  <Ionicons name="play-outline" size={15} color={colors.textStrong} />
                </Pressable>
                <View style={styles.ideasDropdownDivider} />
                {/* Import moved here from the "+" FAB — record stands alone. */}
                <Pressable
                  style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                  onPress={() => {
                    setHeaderMenuOpen(false);
                    haptic.tap();
                    void importFlow.openImportAudioFlow();
                  }}
                >
                  <Text style={styles.ideasSortMenuItemText}>{t("songDetail.import")}</Text>
                  <Ionicons name="download-outline" size={15} color={colors.textStrong} />
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.ideasDropdownDivider} />
                <Pressable
                  style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                  onPress={() => {
                    setHeaderMenuOpen(false);
                    haptic.tap();
                    appActions.convertSelectedClipIdeaToProject();
                    // Same step the other two sketch entry points take: name and
                    // stage it now, while the intent is fresh (2026-09-10).
                    screen.setIsEditMode(true);
                  }}
                >
                  <Text style={styles.ideasSortMenuItemText}>{t("songDetail.makeSong")}</Text>
                  <Ionicons name="albums-outline" size={15} color={colors.textStrong} />
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
                      isProject ? t("songDetail.deleteSongTitle") : t("songDetail.deleteClipTitle"),
                      isProject
                        ? t("songDetail.deleteSongBody", { title: selectedIdea.title })
                        : t("songDetail.deleteClipBody", { title: selectedIdea.title }),
                      () => {
                        appActions.deleteSelectedIdea();
                        screen.navigation.goBack();
                      },
                      { confirmLabel: t("common.delete") }
                    );
                  }}
                >
                  <Text style={isSelectingClips ? styles.ideasSortMenuItemText : styles.songDetailDangerMenuText}>
                    {isProject ? t("songDetail.deleteSong") : t("songDetail.deleteClip")}
                  </Text>
                  <Ionicons name="trash-outline" size={15} color={isSelectingClips ? "#a89a96" : colors.danger} />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

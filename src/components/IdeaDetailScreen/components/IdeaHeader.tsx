import { View, Text, Pressable } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { styles } from "../styles";
import { TitleInput } from "../../common/TitleInput";
import { IconButton } from "../../common/IconButton";
import { SideMenuButton } from "../../common/SideMenuButton";
import { useSongScreen } from "../provider/SongScreenProvider";
import { COMPACT_TITLE_FADE_IN_END, COMPACT_TITLE_FADE_IN_START } from "../headerCollapse";
import { haptic } from "../../../design/haptics";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";
import { useOriginLabel } from "../../../hooks/useOriginLabel";

export function IdeaHeader() {
  const { t } = useTranslation();
  const { screen, editFlow, actions } = useSongScreen();

  const selectedIdea = screen.selectedIdea;
  // The back button is labelled with where back actually lands (2026-09-16): the
  // collection when this idea was opened from it, else the origin — Activity,
  // Search, the Shelf… Read from the route beneath, so label and action agree.
  const originLabel = useOriginLabel();
  if (!selectedIdea) return null;

  const isEditMode = screen.isEditMode;
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
  // Just the destination, nothing else: the page's own type is the page you are on.
  const eyebrowText = originLabel ?? "";

  return (
    <View style={styles.songDetailHeader}>
      {/* Nav row: chevron back | (spacer or compact title) | ellipsis/edit actions */}
      <View style={styles.songDetailNavRow}>
        <Pressable
          testID="song-header-back"
          accessibilityRole="button"
          accessibilityLabel={originLabel ? t("common.backTo", { label: originLabel }) : t("common.back")}
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
          <View style={styles.songDetailNavTrail}>
            {/* The side menu's door on a pushed page: the workspace mark. */}
            <SideMenuButton />
            <IconButton
              icon="ellipsis-horizontal"
              tone="muted"
              size={20}
              onPress={() => screen.setHeaderMenuOpen(!screen.headerMenuOpen)}
              accessibilityLabel={t("common.moreOptions")}
            />
          </View>
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
    </View>
  );
}

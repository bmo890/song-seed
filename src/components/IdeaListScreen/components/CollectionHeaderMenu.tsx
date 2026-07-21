import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { useStore } from "../../../state/useStore";
import { buildPlayableQueueFromIdeas } from "../../../domain/clipPresentation";
import { durations } from "../../../design/motion";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

export function CollectionHeaderMenu() {
  const { t } = useTranslation();
  const { screen, inlinePlayer, store } = useCollectionScreen();

  if (!screen.headerMenuOpen) return null;

  const playableIdeas = screen.listEntries
    .filter((entry): entry is Extract<(typeof screen.listEntries)[number], { type: "idea" }> => entry.type === "idea")
    .map((entry) => entry.idea);

  const playAllIdeas = async () => {
    const queue = buildPlayableQueueFromIdeas(playableIdeas);
    if (queue.length === 0) return;
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueueForScreen(queue, 0, true);
  };

  return (
    <View style={styles.ideasHeaderMenuLayer} pointerEvents="box-none">
      <Pressable
        style={styles.ideasHeaderMenuBackdrop}
        onPress={() => screen.setHeaderMenuOpen(false)}
      />
      <Animated.View
        style={[styles.ideasSortMenu, styles.ideasHeaderOverflowMenu]}
        entering={FadeIn.duration(durations.fast)}
      >
        <Pressable
          style={({ pressed }) => [
            styles.ideasToggleRow,
            buildPlayableQueueFromIdeas(playableIdeas).length === 0 ? styles.btnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => {
            haptic.tap();
            screen.setHeaderMenuOpen(false);
            void playAllIdeas();
          }}
          disabled={buildPlayableQueueFromIdeas(playableIdeas).length === 0}
        >
          <Text style={styles.ideasSortMenuItemText}>{t("collection.playAll")}</Text>
          <Ionicons name="play" size={15} color="#334155" />
        </Pressable>
        <View style={styles.ideasDropdownDivider} />
        <Pressable
          style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
          onPress={() => {
            screen.setListDensity((prev) => (prev === "compact" ? "comfortable" : "compact"));
            screen.setHeaderMenuOpen(false);
          }}
        >
          <Text style={styles.ideasSortMenuItemText}>{t("collection.compactView")}</Text>
          <View
            style={[
              styles.ideasSwitch,
              screen.listDensity === "compact" ? styles.ideasSwitchActive : null,
            ]}
          >
            <View
              style={[
                styles.ideasSwitchThumb,
                screen.listDensity === "compact" ? styles.ideasSwitchThumbActive : null,
              ]}
            />
          </View>
        </Pressable>
        <View style={styles.ideasDropdownDivider} />
        <Pressable
          style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            screen.setHeaderMenuOpen(false);
            screen.navigateRoot("Activity", {
              workspaceId: screen.activeWorkspace?.id,
              collectionId: screen.currentCollection?.id,
            });
          }}
        >
          <Text style={styles.ideasSortMenuItemText}>{t("collection.viewActivity")}</Text>
          <Ionicons name="grid-outline" size={15} color="#334155" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

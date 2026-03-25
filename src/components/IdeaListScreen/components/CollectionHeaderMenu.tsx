import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { useStore } from "../../../state/useStore";
import { buildPlayableQueueFromIdeas } from "../../../clipPresentation";

export function CollectionHeaderMenu() {
  const { screen, inlinePlayer, store } = useCollectionScreen();

  if (!screen.headerMenuOpen) return null;

  const playableIdeas = screen.listEntries
    .filter((entry): entry is Extract<(typeof screen.listEntries)[number], { type: "idea" }> => entry.type === "idea" && !entry.hidden)
    .map((entry) => entry.idea);

  const playAllIdeas = async () => {
    const queue = buildPlayableQueueFromIdeas(playableIdeas);
    if (queue.length === 0) return;
    await inlinePlayer.resetInlinePlayer();
    useStore.getState().setPlayerQueue(queue, 0, true);
    screen.navigateRoot("Player");
  };

  return (
    <View style={styles.ideasHeaderMenuLayer} pointerEvents="box-none">
      <Pressable
        style={styles.ideasHeaderMenuBackdrop}
        onPress={() => screen.setHeaderMenuOpen(false)}
      />
      <View style={[styles.ideasSortMenu, styles.ideasHeaderOverflowMenu]}>
        <Pressable
          style={({ pressed }) => [
            styles.ideasToggleRow,
            buildPlayableQueueFromIdeas(playableIdeas).length === 0 ? styles.btnDisabled : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={() => {
            screen.setHeaderMenuOpen(false);
            void playAllIdeas();
          }}
          disabled={buildPlayableQueueFromIdeas(playableIdeas).length === 0}
        >
          <Text style={styles.ideasSortMenuItemText}>Play all</Text>
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
          <Text style={styles.ideasSortMenuItemText}>Compact view</Text>
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
            screen.setHeaderMenuOpen(false);
            screen.navigateRoot("Activity", {
              workspaceId: screen.activeWorkspace?.id,
              collectionId: screen.currentCollection?.id,
            });
          }}
        >
          <Text style={styles.ideasSortMenuItemText}>View activity</Text>
          <Ionicons name="grid-outline" size={15} color="#334155" />
        </Pressable>
      </View>
    </View>
  );
}

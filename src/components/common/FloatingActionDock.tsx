import { useState } from "react";
import { Pressable, Text, View, StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";
import { durations } from "../../design/motion";
import { haptic } from "../../design/haptics";
import { useStore } from "../../state/useStore";

const FLOATING_ACTION_DOCK_BASE_BOTTOM = 12;
const FLOATING_ACTION_DOCK_MIN_SAFE_AREA = 16;
const FLOATING_ACTION_DOCK_RECORD_BUTTON_SIZE = 62;
const FLOATING_ACTION_DOCK_CONTENT_GAP = 24;
const FLOATING_ACTION_DOCK_SCROLL_PAST_EXTRA = 152;

type FloatingActionMenuItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  iconColor?: string;
};

type FloatingActionDockProps = {
  menuItems: FloatingActionMenuItem[];
  onRecord: () => void;
  wrapStyle?: StyleProp<ViewStyle>;
  onDockLayout?: (height: number) => void;
};

export function getFloatingActionDockBottomOffset(bottomInset: number) {
  return FLOATING_ACTION_DOCK_BASE_BOTTOM + Math.max(bottomInset, FLOATING_ACTION_DOCK_MIN_SAFE_AREA);
}

export function getFloatingActionDockContentClearance(bottomInset: number) {
  return (
    getFloatingActionDockBottomOffset(bottomInset) +
    FLOATING_ACTION_DOCK_RECORD_BUTTON_SIZE +
    FLOATING_ACTION_DOCK_CONTENT_GAP
  );
}

export function getFloatingActionDockScrollPastClearance(bottomInset: number) {
  return getFloatingActionDockContentClearance(bottomInset) + FLOATING_ACTION_DOCK_SCROLL_PAST_EXTRA;
}

export function FloatingActionDock({
  menuItems,
  onRecord,
  wrapStyle,
  onDockLayout,
}: FloatingActionDockProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  // Ride just above the global media dock when it's present (the dock already
  // covers the bottom safe area, so DON'T add the safe-area base on top of it —
  // that double-counts and floats the buttons too high). Otherwise use the normal
  // safe-area offset.
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  // The import bar reserves height while a library import runs; float the FABs above it.
  const importBannerHeight = useStore((s) => s.importBannerHeight);
  const bottomOffset =
    (playerDockHeight > 0
      ? playerDockHeight + FLOATING_ACTION_DOCK_BASE_BOTTOM
      : getFloatingActionDockBottomOffset(insets.bottom)) + importBannerHeight;

  return (
    <View pointerEvents="box-none" style={[styles.ideasFabWrap, { bottom: bottomOffset }, wrapStyle]}>
      {menuOpen && menuItems.length > 0 ? (
        <Animated.View
          style={styles.ideasFabMenu}
          entering={FadeInDown.duration(durations.base)}
          exiting={FadeOut.duration(durations.fast)}
        >
          {menuItems.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.ideasFabMenuItem, pressed ? styles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                setMenuOpen(false);
                item.onPress();
              }}
            >
              <Ionicons name={item.icon} size={16} color={item.iconColor ?? "#0f172a"} />
              <Text style={styles.ideasFabMenuItemText}>{item.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      <View
        style={styles.ideasFabRow}
        onLayout={(event) => {
          onDockLayout?.(event.nativeEvent.layout.height);
        }}
      >
        <Pressable
          style={({ pressed }) => [styles.ideasCreateFab, pressed ? styles.pressDownStrong : null]}
          onPress={() => {
            haptic.tap();
            setMenuOpen((prev) => !prev);
          }}
        >
          <Ionicons name={menuOpen ? "close" : "add"} size={20} color="#0f172a" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ideasRecordFab, pressed ? styles.pressDownStrong : null]}
          onPress={() => {
            haptic.grab();
            setMenuOpen(false);
            onRecord();
          }}
        >
          <Ionicons name="mic" size={22} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

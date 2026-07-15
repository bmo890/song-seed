import { useState } from "react";
import { Pressable, Text, View, StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";
import { durations } from "../../design/motion";
import { haptic } from "../../design/haptics";
import { useStore } from "../../state/useStore";
import {
  getFloatingActionDockBottomOffset,
} from "./floatingActionDockLayout";

// Re-exported so call sites can keep importing dock layout from the dock itself.
export {
  getFloatingActionDockBottomOffset,
  getFloatingActionDockContentClearance,
  type FloatingActionDockLayout,
} from "./floatingActionDockLayout";

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

export function FloatingActionDock({
  menuItems,
  onRecord,
  wrapStyle,
  onDockLayout,
}: FloatingActionDockProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  // Ride above the global media dock and the import bar when they're present. Shared
  // with every list's footer spacer, so content clearance always matches reality.
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const importBannerHeight = useStore((s) => s.importBannerHeight);
  const bottomOffset = getFloatingActionDockBottomOffset(insets.bottom, {
    playerDockHeight,
    importBannerHeight,
  });

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
              testID={`fab-menu-${item.key}`}
              accessibilityLabel={item.label}
              style={({ pressed }) => [styles.ideasFabMenuItem, pressed ? styles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                setMenuOpen(false);
                item.onPress();
              }}
            >
              <Ionicons name={item.icon} size={16} color={item.iconColor ?? colors.primaryDeep} />
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
          testID="fab-create"
          accessibilityLabel={menuOpen ? "Close create menu" : "Create"}
          style={({ pressed }) => [styles.ideasCreateFab, pressed ? styles.pressDownStrong : null]}
          onPress={() => {
            haptic.tap();
            setMenuOpen((prev) => !prev);
          }}
        >
          <Ionicons name={menuOpen ? "close" : "add"} size={20} color={colors.textPrimary} />
        </Pressable>

        <Pressable
          testID="fab-record"
          accessibilityLabel="Record"
          style={({ pressed }) => [styles.ideasRecordFab, pressed ? styles.pressDownStrong : null]}
          onPress={() => {
            haptic.grab();
            setMenuOpen(false);
            onRecord();
          }}
        >
          <Ionicons name="mic" size={22} color={colors.onRecord} />
        </Pressable>
      </View>
    </View>
  );
}

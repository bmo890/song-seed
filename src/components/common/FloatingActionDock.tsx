import { useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
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
import { useTranslation } from "react-i18next";

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
  /** Create-menu rows behind the "+" FAB. Pass an empty array to render the
   *  record FAB alone (the screen surfaces creation elsewhere, e.g. overflow). */
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
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Armed: the record key stays pressed from the tap until the recorder has taken
  // over (this screen loses focus). Creating the take's idea and mounting the
  // recorder is real work on a large library; the key holding its pressed state is
  // what makes that beat read as "taken" rather than "missed" — no spinner, no copy.
  const [armed, setArmed] = useState(false);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!armed) return;
    if (!isFocused) {
      setArmed(false);
      return;
    }
    // Safety: never stay armed if the navigation never happened.
    const timer = setTimeout(() => setArmed(false), 1500);
    return () => clearTimeout(timer);
  }, [armed, isFocused]);
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
        {menuItems.length > 0 ? (
          <Pressable
            testID="fab-create"
            accessibilityLabel={t(menuOpen ? "common.closeCreateMenu" : "common.create")}
            style={({ pressed }) => [styles.ideasCreateFab, pressed ? styles.pressDownStrong : null]}
            onPress={() => {
              haptic.tap();
              setMenuOpen((prev) => !prev);
            }}
          >
            <Ionicons name={menuOpen ? "close" : "add"} size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}

        <Pressable
          testID="fab-record"
          accessibilityLabel={t("common.record")}
          style={({ pressed }) => [styles.ideasRecordFab, pressed || armed ? styles.pressDownStrong : null]}
          onPress={() => {
            haptic.grab();
            setMenuOpen(false);
            setArmed(true);
            onRecord();
          }}
        >
          <Ionicons name="mic" size={22} color={colors.onRecord} />
        </Pressable>
      </View>
    </View>
  );
}

import { useState } from "react";
import { Pressable, Text, View, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";

const FLOATING_ACTION_DOCK_BASE_BOTTOM = 12;
const FLOATING_ACTION_DOCK_MIN_SAFE_AREA = 16;
const FLOATING_ACTION_DOCK_RECORD_BUTTON_SIZE = 62;
const FLOATING_ACTION_DOCK_CONTENT_GAP = 24;

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

export function FloatingActionDock({
  menuItems,
  onRecord,
  wrapStyle,
}: FloatingActionDockProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomOffset = getFloatingActionDockBottomOffset(insets.bottom);

  return (
    <View pointerEvents="box-none" style={[styles.ideasFabWrap, { bottom: bottomOffset }, wrapStyle]}>
      {menuOpen && menuItems.length > 0 ? (
        <View style={styles.ideasFabMenu}>
          {menuItems.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.ideasFabMenuItem, pressed ? styles.pressDown : null]}
              onPress={() => {
                void Haptics.selectionAsync();
                setMenuOpen(false);
                item.onPress();
              }}
            >
              <Ionicons name={item.icon} size={16} color={item.iconColor ?? "#0f172a"} />
              <Text style={styles.ideasFabMenuItemText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.ideasFabRow}>
        <Pressable
          style={({ pressed }) => [styles.ideasCreateFab, pressed ? styles.pressDownStrong : null]}
          onPress={() => {
            void Haptics.selectionAsync();
            setMenuOpen((prev) => !prev);
          }}
        >
          <Ionicons name={menuOpen ? "close" : "add"} size={20} color="#0f172a" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ideasRecordFab, pressed ? styles.pressDownStrong : null]}
          onPress={() => {
            void Haptics.selectionAsync();
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

import { useState } from "react";
import { Pressable, Text, View, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";

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

export function FloatingActionDock({
  menuItems,
  onRecord,
  wrapStyle,
}: FloatingActionDockProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomOffset = 12 + Math.max(insets.bottom, 16);

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

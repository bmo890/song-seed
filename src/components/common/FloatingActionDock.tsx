import { useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Pressable, View, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";
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

type FloatingActionDockProps = {
  onRecord: () => void;
  wrapStyle?: StyleProp<ViewStyle>;
  onDockLayout?: (height: number) => void;
};

/** The record key, riding above the media dock and the import bar. Creation
 *  beyond a take lives in each screen's overflow (2026-10-20: the "+" create
 *  menu had no callers left and is gone). */
/**
 * The record key sits at the END edge: bottom-right in English, bottom-left in
 * Hebrew (Material). Cards mirror, so their play button is at the start edge
 * and the key never covers it (founder, 2026-10-26). Logical `end`, because
 * absolute insets are not swapped in RTL.
 */
const END_EDGE: ViewStyle = { end: 18 };

export function FloatingActionDock({
  onRecord,
  wrapStyle,
  onDockLayout,
}: FloatingActionDockProps) {
  const { t } = useTranslation();
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
    <View pointerEvents="box-none" style={[styles.ideasFabWrap, END_EDGE, { bottom: bottomOffset }, wrapStyle]}>
      <View
        style={styles.ideasFabRow}
        onLayout={(event) => {
          onDockLayout?.(event.nativeEvent.layout.height);
        }}
      >
        <Pressable
          testID="fab-record"
          accessibilityLabel={t("common.record")}
          style={({ pressed }) => [styles.ideasRecordFab, pressed || armed ? styles.pressDownStrong : null]}
          onPress={() => {
            haptic.grab();
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

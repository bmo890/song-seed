import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { haptic } from "../../design/haptics";
import { popIn } from "../../design/motion";
import { dialogStore, type DialogButton, type DialogConfig } from "./dialogStore";

/**
 * Styled in-app dialog that replaces native Alert.alert.
 * Mount exactly one <AppDialogHost /> near the root of the app.
 *
 * Visual language: Nocturne Paper — warm scrim, warm paper card,
 * PlusJakartaSans typography, hairline dividers, action icons.
 *
 * Button presentation:
 * - A button with a `description` renders as a full-width "option row"
 *   (tinted icon · bold label · description) — for choice dialogs.
 * - Otherwise: 2 plain buttons sit side-by-side; 1 or 3+ stack vertically.
 */
export function AppDialogHost() {
  const [config, setConfig] = useState<DialogConfig | null>(null);

  useEffect(() => dialogStore.subscribe(setConfig), []);

  // A destructive ask should be felt before it's read.
  useEffect(() => {
    if (config?.buttons.some((b) => b.style === "destructive")) haptic.warning();
  }, [config]);

  if (!config) return null;

  const dismiss = () => dialogStore.dismiss();
  const handleButton = (onPress?: () => void) => {
    haptic.tap();
    dismiss();
    onPress?.();
  };

  const hasCancel = config.buttons.some((b) => b.style === "cancel");
  const isRich = config.buttons.some((b) => !!b.description);
  const plainButtons = config.buttons.filter((b) => !b.description);
  const sideBySide = !isRich && config.buttons.length === 2;

  const iconColor = (style?: string) =>
    style === "destructive" ? "#a83232" : style === "cancel" ? "#84736f" : "#524440";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={hasCancel ? dismiss : undefined}>
      <Pressable style={s.scrim} onPress={hasCancel ? dismiss : undefined} />
      <View style={s.centring} pointerEvents="box-none">
        <Animated.View style={s.card} entering={popIn}>
          {/* Header */}
          <View style={[s.body, isRich ? s.bodyRich : null]}>
            <Text style={s.title}>{config.title}</Text>
            {config.message ? <Text style={s.message}>{config.message}</Text> : null}
          </View>

          {sideBySide ? (
            <>
              <View style={s.dividerH} />
              <View style={s.buttonRow}>
                {config.buttons.map((btn, i) => (
                  <View key={btn.label} style={s.buttonRowCell}>
                    {i > 0 && <View style={s.dividerV} />}
                    <Pressable
                      style={({ pressed }) => [s.compactBtn, pressed ? s.pressed : null]}
                      onPress={() => handleButton(btn.onPress)}
                    >
                      {btn.icon ? (
                        <Ionicons name={btn.icon} size={16} color={iconColor(btn.style)} />
                      ) : null}
                      <Text style={[s.btnText, btnTextStyle(btn.style)]}>{btn.label}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* Rich option rows first (those with a description) */}
              {config.buttons
                .filter((b) => !!b.description)
                .map((btn) => (
                  <View key={btn.label}>
                    <View style={s.dividerH} />
                    <RichRow btn={btn} onPress={() => handleButton(btn.onPress)} />
                  </View>
                ))}

              {/* Then any plain buttons, stacked and centred */}
              {plainButtons.map((btn) => (
                <View key={btn.label}>
                  <View style={s.dividerH} />
                  <Pressable
                    style={({ pressed }) => [s.stackBtn, pressed ? s.pressed : null]}
                    onPress={() => handleButton(btn.onPress)}
                  >
                    {btn.icon ? (
                      <Ionicons name={btn.icon} size={16} color={iconColor(btn.style)} />
                    ) : null}
                    <Text style={[s.btnText, btnTextStyle(btn.style)]}>{btn.label}</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function RichRow({ btn, onPress }: { btn: DialogButton; onPress: () => void }) {
  const destructive = btn.style === "destructive";
  return (
    <Pressable style={({ pressed }) => [s.richRow, pressed ? s.pressed : null]} onPress={onPress}>
      {btn.icon ? (
        <View style={[s.richIconWrap, destructive ? s.richIconWrapDanger : null]}>
          <Ionicons name={btn.icon} size={19} color={destructive ? "#a83232" : "#524440"} />
        </View>
      ) : null}
      <View style={s.richTextCol}>
        <Text style={[s.richLabel, destructive ? s.richLabelDanger : null]}>{btn.label}</Text>
        {btn.description ? <Text style={s.richDesc}>{btn.description}</Text> : null}
      </View>
    </Pressable>
  );
}

function btnTextStyle(style?: string) {
  if (style === "destructive") return s.btnTextDestructive;
  if (style === "cancel") return s.btnTextCancel;
  return s.btnTextDefault;
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,28,25,0.45)",
  },
  centring: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  card: {
    width: "100%",
    backgroundColor: "#FDFBF7",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#3D3732",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 6,
  },
  bodyRich: {
    paddingBottom: 14,
  },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
    color: "#1b1c1a",
    textAlign: "center",
  },
  message: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#524440",
    textAlign: "center",
  },
  dividerH: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E8E4DF",
  },
  dividerV: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#E8E4DF",
  },
  // Side-by-side
  buttonRow: {
    flexDirection: "row",
    minHeight: 50,
  },
  buttonRowCell: {
    flex: 1,
    flexDirection: "row",
  },
  compactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  // Stacked plain
  stackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 15,
    paddingHorizontal: 20,
    minHeight: 50,
  },
  // Rich option row
  richRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  richIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F4F1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  richIconWrapDanger: {
    backgroundColor: "#FBEDEC",
  },
  richTextCol: {
    flex: 1,
    gap: 2,
  },
  richLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    lineHeight: 19,
    color: "#1b1c1a",
  },
  richLabelDanger: {
    color: "#a83232",
  },
  richDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12.5,
    lineHeight: 17,
    color: "#84736f",
  },
  pressed: {
    backgroundColor: "#F4F1ED",
  },
  btnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
  btnTextDefault: { color: "#1b1c1a" },
  btnTextCancel: { color: "#84736f" },
  btnTextDestructive: {
    color: "#a83232",
    fontFamily: "PlusJakartaSans_700Bold",
  },
});

import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { AnimatedCollapse } from "../../common/AnimatedCollapse";
import { playerScreenStyles as s } from "../styles";
import type { PracticeTool } from "../hooks/usePlayerScreenUi";
import { haptic } from "../../../design/haptics";

export function Chip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.toolChip, active ? s.toolChipActive : null, disabled ? s.toolChipDisabled : null]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.toolChipText, active ? s.toolChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function AccordionRow({
  tool,
  icon,
  label,
  value,
  valueOnLeft = false,
  headerAccessory,
  expanded,
  onToggle,
  children,
}: {
  tool: PracticeTool;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** Render the value inline next to the title instead of on the right. */
  valueOnLeft?: boolean;
  /** An extra control on the header's right (e.g. an add button). Stops the header toggle. */
  headerAccessory?: React.ReactNode;
  expanded: boolean;
  onToggle: (tool: PracticeTool) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.toolCard}>
      <Pressable
        style={({ pressed }) => [s.toolHeader, pressed ? s.toolHeaderPressed : null]}
        onPress={() => {
          haptic.tap();
          onToggle(tool);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${label}: ${value}`}
      >
        <View style={s.toolHeaderLeft}>
          <Ionicons name={icon} size={16} color={colors.textSecondary} />
          <Text style={s.toolLabel}>{label}</Text>
          {valueOnLeft ? <Text style={s.toolValueInline}>{value}</Text> : null}
        </View>
        <View style={s.toolHeaderRight}>
          {!valueOnLeft ? (
            <Text style={s.toolValue} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {headerAccessory}
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </View>
      </Pressable>
      <AnimatedCollapse visible={expanded} style={s.toolBody}>
        {children}
      </AnimatedCollapse>
    </View>
  );
}

/** The reel's playhead colour — used to tint the I-beam "set to playhead" icon. */
export const PLAYHEAD_COLOR = colors.playhead;

/** A Logic-style I-beam playhead cursor (vertical stem with top/bottom caps). */
export function PlayheadCursorIcon({ color }: { color: string }) {
  return (
    <View style={s.ibeam}>
      <View style={[s.ibeamCap, { backgroundColor: color }]} />
      <View style={[s.ibeamStem, { backgroundColor: color }]} />
      <View style={[s.ibeamCap, { backgroundColor: color }]} />
    </View>
  );
}

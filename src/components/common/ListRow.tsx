import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "./Press";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { dirIcon } from "../../design/directionalIcons";
import { UserText } from "../../i18n";

/**
 * A row on paper: the one shape for lists that are structure (2026-10-15).
 *
 * Cards mean your work (ideas, clips, sketches). Places and records that hold
 * work (playlists, setlists, songbooks, received parcels, settings) are rows:
 * a bare ink glyph, a name, a quiet meta line, a chevron, a hairline below. No
 * fill, no border, no tinted icon tile. Wrap a run of them in `ListRows` for
 * the hairline above the first.
 */
export function ListRow({
  icon,
  title,
  meta,
  accessory,
  onPress,
  onLongPress,
  serifTitle = true,
  userTitle = true,
  testID,
  accessibilityLabel,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  /** A short line under the title: counts, dates, provenance. */
  meta?: ReactNode;
  /** Before the chevron: an unread dot, a count. */
  accessory?: ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  /** A name a person typed earns the serif; a machine label does not. */
  serifTitle?: boolean;
  /** The title is user text: its direction follows its content. */
  userTitle?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const titleStyle = serifTitle ? rowStyles.titleSerif : rowStyles.title;
  return (
    <Press
      // Haptics vocabulary: a row only takes you somewhere; navigation is silent.
      haptic="navigate"
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={rowStyles.row}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={rowStyles.icon}>
        <Ionicons name={icon} size={19} color={colors.textStrong} />
      </View>
      <View style={rowStyles.copy}>
        {userTitle ? (
          <UserText value={title} style={titleStyle} numberOfLines={1}>
            {title}
          </UserText>
        ) : (
          <Text style={titleStyle} numberOfLines={1}>
            {title}
          </Text>
        )}
        {meta != null ? (
          typeof meta === "string" ? (
            <Text style={rowStyles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : (
            <View style={rowStyles.metaRow}>{meta}</View>
          )
        ) : null}
      </View>
      {accessory ?? null}
      <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.textMuted} />
    </Press>
  );
}

/** A run of rows: the hairline above the first. */
export function ListRows({ children }: { children: ReactNode }) {
  return <View style={rowStyles.list}>{children}</View>;
}

/** The quiet meta line, for callers composing their own meta row. */
export function ListRowMeta({ children }: { children: ReactNode }) {
  return (
    <Text style={rowStyles.meta} numberOfLines={1}>
      {children}
    </Text>
  );
}

const rowStyles = StyleSheet.create({
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  icon: {
    width: 22,
    alignItems: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleSerif: {
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: colors.textPrimary,
  },
  title: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meta: {
    ...textTokens.caption,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
});

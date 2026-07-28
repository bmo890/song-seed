import React from "react";
import { I18nManager, StyleSheet, Text, View } from "react-native";
import { IconButton } from "../../common/IconButton";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText, physicalTextAlign } from "../../../i18n";

type RecordingHeaderProps = {
  eyebrow: string | null;
  /** One-word form of the eyebrow, used by the collapsed header where the whole
   *  destination has to fit on the nav row. */
  eyebrowShort?: string | null;
  title: string;
  titleIsPlaceholder: boolean;
  controlsDisabled: boolean;
  /** Collapse to a single nav row — the destination rides it in small serif so
   *  you never lose sight of where the take is going, and the reclaimed height
   *  goes to the lyrics. */
  collapsed?: boolean;
  onBack: () => void;
  onMinimize: () => void;
  onOpenSettings: () => void;
  onHelp: () => void;
};

/**
 * An auto-generated title is a label the APP wrote, not something the user typed,
 * so it should sit on the same edge as the eyebrow above it — otherwise a Hebrew
 * recorder shows a right-aligned eyebrow over a left-aligned "10:58 AM Jul 28th"
 * and the header reads as broken in half.
 *
 * ALIGNMENT and READING ORDER have to be set separately here. Forcing the whole
 * text to RTL right-aligns it but also re-orders its Latin runs, turning
 * "10:58 AM Jul 28th" into "AM Jul 28th 10:58". So the string keeps its own
 * writing direction (via UserText's "auto") and only the alignment follows the
 * UI. `physicalTextAlign` pre-inverts for RN's left/right swap.
 */
const AUTO_TITLE_ALIGN = {
  textAlign: physicalTextAlign(I18nManager.isRTL ? "right" : "left"),
} as const;

export function RecordingHeader({
  eyebrow,
  eyebrowShort,
  title,
  titleIsPlaceholder,
  controlsDisabled,
  collapsed = false,
  onBack,
  onMinimize,
  onOpenSettings,
  onHelp,
}: RecordingHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={[localStyles.zone, collapsed ? localStyles.zoneCollapsed : null]}>
      <View style={localStyles.topRow}>
        {/* Bare caret. The word "Back" was the only text button in the app's
            chrome, and this screen already asks a lot of the eye. */}
        <IconButton
          icon="chevron-back"
          tone="strong"
          size={22}
          onPress={onBack}
          accessibilityLabel={t("recording.back")}
        />

        {collapsed ? (
          <View style={localStyles.collapsedDest}>
            {eyebrowShort ? (
              <Text style={localStyles.eyebrowTextShort} numberOfLines={1}>
                {eyebrowShort}
              </Text>
            ) : null}
            <UserText
              style={[
                localStyles.collapsedTitle,
                titleIsPlaceholder ? localStyles.collapsedTitleAuto : null,
                titleIsPlaceholder ? AUTO_TITLE_ALIGN : null,
              ]}
              numberOfLines={1}
            >
              {title}
            </UserText>
          </View>
        ) : (
          <View style={localStyles.spacer} />
        )}

        {/* Glyphs, not tinted circles — the record button is the only circle on
            this page (see docs/design-system.md, recording screen). */}
        <View style={localStyles.actionRow}>
          <IconButton
            icon="help-circle-outline"
            tone="muted"
            size={19}
            onPress={onHelp}
            accessibilityLabel={t("recording.help")}
          />
          <IconButton
            icon="remove"
            tone="muted"
            size={20}
            onPress={onMinimize}
            accessibilityLabel={t("recording.minimize")}
          />
          <IconButton
            icon="ellipsis-horizontal"
            tone="muted"
            size={20}
            disabled={controlsDisabled}
            onPress={onOpenSettings}
            accessibilityLabel={t("recording.settings")}
          />
        </View>
      </View>

      {!collapsed && eyebrow ? (
        // No dot: the eyebrow is a landmark, not a status light, and terracotta
        // is reserved for the action. Same treatment as SKETCH on the sketch page.
        <Text style={localStyles.eyebrowText}>{eyebrow}</Text>
      ) : null}

      {!collapsed ? (
        <UserText
          style={[
            titleIsPlaceholder ? localStyles.titlePlaceholder : localStyles.title,
            titleIsPlaceholder ? AUTO_TITLE_ALIGN : null,
          ]}
          numberOfLines={1}
        >
          {title}
        </UserText>
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  zone: {
    gap: 3,
    marginBottom: 12,
  },
  zoneCollapsed: {
    gap: 0,
    marginBottom: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
  },
  spacer: {
    flex: 1,
  },
  collapsedDest: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  eyebrowText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    lineHeight: 14,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
  },
  eyebrowTextShort: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    flexShrink: 0,
  },
  collapsedTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Lora_500Medium",
    fontSize: 15,
    color: colors.textPrimary,
  },
  collapsedTitleAuto: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13.5,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  title: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 21,
    color: colors.textPrimary,
  },
  titlePlaceholder: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 17,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});

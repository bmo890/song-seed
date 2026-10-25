import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { PopoverRadioRow } from "./PopoverMenu";
import { styles } from "../../styles";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { durations } from "../../design/motion";
import { APP_LANGUAGES, languageLabel, useLocale, type AppLanguage } from "../../i18n";

/**
 * The app language as a dropdown: flag + the language's own name, opening the same
 * radio popover the Settings value rows use, over the same shared list
 * (i18n/languages.ts). Picking one restarts the app in that language, as Settings
 * does; the caller decides whether to ask first (`onBeforeChange`).
 */
export function LanguageSelect({
  onBeforeChange,
}: {
  /** Return false to cancel; may show its own confirm and call `proceed` later. */
  onBeforeChange?: (next: AppLanguage, proceed: () => void) => boolean;
}) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLocale();
  const [open, setOpen] = useState(false);

  const choose = (next: AppLanguage) => {
    setOpen(false);
    if (next === language) return;
    const proceed = () => void setLanguage(next).catch(() => {});
    if (onBeforeChange && !onBeforeChange(next, proceed)) return;
    proceed();
  };

  return (
    <View style={[s.wrap, open ? s.wrapOpen : null]}>
      {open ? (
        <Press
          feel="still"
          // Haptics vocabulary: `light` — the small panel closes, as it opened.
          haptic="light"
          style={s.backdrop}
          onPress={() => setOpen(false)}
          accessible={false}
        />
      ) : null}
      <Press
        // Haptics vocabulary: `light` — a small panel opens.
        haptic="light"
        style={s.trigger}
        onPress={() => setOpen((wasOpen) => !wasOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${t("settings.appLanguage")}: ${languageLabel(language)}`}
        testID="language-select"
      >
        <Text style={s.triggerText}>{languageLabel(language)}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
      </Press>
      {open ? (
        <Animated.View entering={FadeIn.duration(durations.fast)} style={[styles.ideasSortMenu, s.menu]}>
          {APP_LANGUAGES.map((option) => (
            <PopoverRadioRow
              key={option.code}
              label={languageLabel(option.code)}
              selected={option.code === language}
              onPress={() => choose(option.code)}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignSelf: "center",
  },
  wrapOpen: {
    zIndex: 30,
    elevation: 30,
  },
  backdrop: {
    position: "absolute",
    top: -2000,
    bottom: -2000,
    left: -2000,
    right: -2000,
    zIndex: 20,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
  },
  triggerText: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textStrong,
  },
  // Opens upward, over the logo: the page dots and the start key sit below,
  // and the list grows with every language added.
  menu: {
    position: "absolute",
    bottom: 44,
    alignSelf: "center",
    minWidth: 180,
    zIndex: 40,
  },
});

import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../../../design/tokens";
import { PIN_ICON, PIN_ICON_OUTLINE } from "../../../design/markIcons";
import { playerScreenStyles } from "../styles";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { Press } from "../../common/Press";

type MarksToggleProps = {
  visible: boolean;
  onToggle: () => void;
  /** The slim reading / writing bar has no room for a word: the pin glyph alone. */
  compact?: boolean;
};

/**
 * Show / hide the reel's marks (sections and pins).
 *
 * It was an eye that lit up when the marks were HIDDEN (founder, 2026-10-13:
 * "is it opposite logic?" — it was). Now it is the word "Marks" in editorial
 * ink: the dot is lit while the marks are on the reel and hollow while they are
 * not, the same way every other on/off in the app reads. No state is narrated
 * ("Marks hidden" is gone) and the row never re-flows.
 *
 * Compact (slim bars): the app's pin glyph, filled while marks show, outline
 * and faded while they do not.
 *
 * Full (2026-10-15): an ink key like Layer and Tools beside it, led by the pin
 * glyph: terracotta and filled while the marks are on the reel, muted and
 * outlined while they are off (founder: "adjust the Marks button... with an
 * icon, and show as active/inactive").
 */
export function MarksToggle({ visible, onToggle, compact }: MarksToggleProps) {
  const { t } = useTranslation();
  const a11y = visible ? t("player.hideMarkers") : t("player.showMarkers");
  if (compact) {
    return (
      <Press
        // Haptics (Press): `light` — a small state flip, the marks show or hide.
        haptic="light"
        style={playerScreenStyles.readingIconButton}
        onPress={onToggle}
        hitSlop={6}
        accessibilityRole="switch"
        accessibilityState={{ checked: visible }}
        accessibilityLabel={a11y}
      >
        <Ionicons
          name={visible ? PIN_ICON : PIN_ICON_OUTLINE}
          size={15}
          color={visible ? colors.textStrong : colors.textMuted}
        />
      </Press>
    );
  }
  const tone = visible ? "active" : "off";
  return (
    <InkKey
      // Haptics vocabulary: `light` — a small state flip, the marks show or hide.
      haptic="light"
      role="switch"
      tone={tone}
      label={t("player.marks")}
      glyph={<Ionicons name={visible ? PIN_ICON : PIN_ICON_OUTLINE} size={16} color={inkKeyColor(tone)} />}
      onPress={onToggle}
      accessibilityLabel={a11y}
    />
  );
}

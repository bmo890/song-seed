import React, { useCallback, useState } from "react";
import { Pressable, Text, type TextLayoutEventData, type NativeSyntheticEvent } from "react-native";
import { styles } from "../../../styles";
import { extractSnippet } from "../../../domain/search";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

/** Inline spans (not a nested block) so the outer Text's clamp still governs. */
function renderHighlighted(text: string, needle?: string) {
  if (!needle) return text;
  const start = text.toLowerCase().indexOf(needle.toLowerCase());
  if (start === -1 || needle.length === 0) return text;
  const end = start + needle.length;
  return (
    <>
      {text.slice(0, start)}
      <Text style={styles.ideasListCardTitleHighlight}>{text.slice(start, end)}</Text>
      {text.slice(end)}
    </>
  );
}

/** Lines shown when collapsed. One is stingy for something you wrote. */
const CLAMP_LINES = 2;
/** Ceiling on the expanded note. A pasted essay must never turn a row into a
 *  page — past this the note stays clipped and the notes sheet owns the rest. */
const MAX_EXPANDED_LINES = 10;

type ClipNoteLineProps = {
  notes: string;
  /** Active search term — when the hit lives past the clamp, the visible window
   *  slides to the match instead of stubbornly showing the note's head. */
  needle?: string;
  /** Opens the full note (the notes sheet) — also the escape hatch for a note
   *  too long to expand inline. */
  onOpen?: () => void;
  /** Long-press belongs to the CARD, not the note: holding any part of a clip
   *  enters selection everywhere else in the app, and a nested Pressable would
   *  otherwise swallow the gesture. Callers forward their row handler here. */
  onLongPress?: () => void;
  disabled?: boolean;
};

/**
 * A clip's note, everywhere: earned serif (italic Lora — content you wrote),
 * clamped to two lines, with a `more` affordance that appears ONLY when the
 * text genuinely overflows (measured via onTextLayout, never guessed from
 * character counts, which lie at different widths and font scales).
 */
export const ClipNoteLine = React.memo(function ClipNoteLine({
  notes,
  needle,
  onOpen,
  onLongPress,
  disabled,
}: ClipNoteLineProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const trimmed = notes.trim();

  // Measured against a hidden UNCLAMPED twin: with numberOfLines set, RN's
  // onTextLayout only reports the lines it actually drew, so the visible Text
  // can never report more than the clamp — it would always look like it fits.
  const onMeasureLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const next = event.nativeEvent.lines.length > CLAMP_LINES;
      setOverflows((prev) => (prev === next ? prev : next));
    },
    []
  );

  if (!trimmed) return null;

  // Search wins the window: lead with the matched line, not the note's opening.
  const searchWindow = needle ? extractSnippet(trimmed, needle) : null;
  const body = searchWindow ?? trimmed;
  const numberOfLines = expanded ? MAX_EXPANDED_LINES : CLAMP_LINES;
  // A note past the expanded ceiling can't be read inline — hand it to the sheet.
  const showsMore = overflows && !expanded;
  const showsLess = overflows && expanded;

  // One gesture, one meaning, whatever the note's length: tapping the note opens
  // it. Expansion is its own word (More/Less) rather than a second job for the
  // same tap — the old split ("short note opens, long note expands") made the
  // gesture read as random.
  const handlePress = () => {
    if (disabled) return;
    onOpen?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={disabled ? undefined : onLongPress}
      delayLongPress={300}
      disabled={disabled}
      hitSlop={{ top: 2, bottom: 4 }}
      accessibilityRole={disabled ? undefined : "button"}
      accessibilityLabel={trimmed}
    >
      {/* Hidden twin, laid out at the same width but unclamped — the only way to
          learn the true line count. Never drawn, never hit-tested. */}
      <Text
        style={[styles.clipNoteLine, styles.clipNoteLineMeasure]}
        onTextLayout={onMeasureLayout}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {body}
      </Text>
      <Text style={styles.clipNoteLine} numberOfLines={numberOfLines}>
        {renderHighlighted(body, needle)}
      </Text>
      {/* Outside the clamp on purpose: nested inside, the word sits past the
          line limit and the ellipsis swallows the very affordance it needs. */}
      {showsMore || showsLess ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            haptic.tap();
            setExpanded((prev) => !prev);
          }}
          disabled={disabled}
          hitSlop={{ top: 4, bottom: 6, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          <Text style={styles.clipNoteLineMore}>
            {showsMore ? t("common.more") : t("common.less")}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
});

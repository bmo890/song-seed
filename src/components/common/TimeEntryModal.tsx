import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, text } from "../../design/tokens";
import { formatTimeEntry, formatTimeMs, readTimeEntry, timeEntryToMs } from "../../domain/timeEntry";
import { Button } from "./Button";
import { WarmModal } from "./WarmModal";

/**
 * Type a time for a mark's edge — the reel's At / Start / End boxes, held.
 *
 * A warm dialog, not an inline field: it brings its own keyboard-avoiding
 * card to the middle of the screen, so the box being edited is always in
 * view, and it gives the edit a clear Set and Cancel.
 *
 * The figure fills from the right like a timer (domain/timeEntry): "123"
 * reads 1:23, a dot adds tenths. It opens showing the current time in resting
 * ink; the first key replaces it. The keys land in an invisible field laid
 * over the figure and the figure is drawn from them — the field's own text is
 * never rewritten, so fast typing cannot race a reformat. The value wears the
 * serif the dials' values wear. Out-of-range times are clamped to the span the
 * line beneath states.
 */
export type TimeEntryModalProps = {
  visible: boolean;
  /** Which edge is being set: "Start", "End", "At". */
  title: string;
  initialMs: number;
  minMs: number;
  maxMs: number;
  onConfirm: (ms: number) => void;
  onClose: () => void;
};

/** Digits and one dot; a comma (some locales' decimal key) reads as the dot. */
function sanitize(text: string): string {
  return text.replace(/,/g, ".").replace(/[^0-9.]/g, "");
}

export function TimeEntryModal({ visible, title, initialMs, minMs, maxMs, onConfirm, onClose }: TimeEntryModalProps) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState("");
  // A fresh field per opening: nothing typed last time carries over.
  const [openSeq, setOpenSeq] = useState(0);
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setRaw("");
      setOpenSeq((seq) => seq + 1);
    }
    wasVisible.current = visible;
  }, [visible]);

  const untouched = raw === "";
  const shown = untouched ? formatTimeMs(initialMs) : formatTimeEntry(readTimeEntry(raw));
  const confirm = () => {
    if (untouched) {
      onClose();
      return;
    }
    onConfirm(Math.max(minMs, Math.min(maxMs, timeEntryToMs(readTimeEntry(raw)))));
  };

  return (
    <WarmModal visible={visible} onRequestClose={onClose} title={title}>
      <View style={s.fieldWrap}>
        <View style={s.figureBox}>
          <Text style={[s.figure, untouched ? s.figureResting : null]} numberOfLines={1}>
            {shown}
          </Text>
          <TextInput
            key={openSeq}
            style={s.keys}
            defaultValue=""
            onChangeText={(next) => setRaw(sanitize(next))}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={confirm}
            autoFocus
            caretHidden
            contextMenuHidden
            autoCorrect={false}
            selectionColor="transparent"
            maxLength={9}
            accessibilityLabel={title}
            accessibilityValue={{ text: shown }}
          />
        </View>
        <View style={s.rule} />
        <Text style={s.range}>
          {t("player.timeRange", { from: formatTimeMs(minMs), to: formatTimeMs(maxMs) })}
        </Text>
      </View>
      <View style={s.actions}>
        <Button variant="quiet" label={t("common.cancel")} onPress={onClose} />
        <Button variant="primary" label={t("player.setTime")} onPress={confirm} />
      </View>
    </WarmModal>
  );
}

const s = StyleSheet.create({
  fieldWrap: {
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  figureBox: {
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  figure: {
    ...text.headerTitle,
    fontSize: 34,
    lineHeight: 42,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  // The time as it stands, before a key is pressed: there to be replaced.
  figureResting: {
    color: colors.textMuted,
  },
  // The real field: over the figure, so a tap on the figure brings the keys back.
  keys: {
    ...StyleSheet.absoluteFillObject,
    padding: 0,
    color: "transparent",
    textAlign: "center",
  },
  // A ruled line, not a box: the value sits on it like a figure on a ledger.
  rule: {
    width: 132,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.primary,
  },
  range: {
    ...text.supporting,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 18,
  },
});

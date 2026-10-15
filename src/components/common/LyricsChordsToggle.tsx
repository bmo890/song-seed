import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "./SegmentedControl";

export type LyricsChordsValue = "lyrics" | "chords";

/** Words or chord chart, for one lyric version: a single choice, so the canon
 *  SegmentedControl in ink (2026-10-15; was a filled terracotta pill). */
export function LyricsChordsToggle({
  value,
  onChange,
}: {
  value: LyricsChordsValue;
  onChange: (value: LyricsChordsValue) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.wrap}>
      <SegmentedControl
        options={[
          { key: "lyrics", label: t("common.lyrics") },
          { key: "chords", label: t("common.chords") },
        ]}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}

const s = StyleSheet.create({
  // Two words: a short track, so the pencil keeps the row's trailing edge.
  wrap: {
    width: 190,
  },
});

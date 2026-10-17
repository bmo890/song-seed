import React, { createContext, useContext, useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { colors } from "../../design/tokens";
import { useSparkPrefsStore } from "../../state/useSparkPrefsStore";
import { BottomSheet } from "./BottomSheet";
import { ChordZoomBar } from "../LyricsVersionScreen/components/chords/ChordZoomBar";
import { useTranslation } from "react-i18next";

/**
 * One shared "paper text" zoom for a Word Sparks exercise, so the words look
 * the same size on every step — and shrinking them buys real screen space on
 * the denser steps. The control is the same as Magpie's: an "Aa" header button
 * opening a slider sheet (ChordZoomBar). Remembered across sparks (2026-10-17).
 */
const BASE_FONT = 17;
const LINE_RATIO = 1.55;

type SparkTextScale = {
  zoom: number;
  setZoom: (zoom: number) => void;
  size: number;
  lineHeight: number;
};

const SparkTextScaleContext = createContext<SparkTextScale>({
  zoom: 1,
  setZoom: () => {},
  size: BASE_FONT,
  lineHeight: Math.round(BASE_FONT * LINE_RATIO),
});

/** The zoom comes from the remembered spark preference, so every spark and
 *  every step opens at the size you last chose. */
export function SparkTextScaleProvider({ children }: { children: React.ReactNode }) {
  const zoom = useSparkPrefsStore((state) => state.zoom);
  const setZoom = useSparkPrefsStore((state) => state.setZoom);
  const value = useMemo<SparkTextScale>(() => {
    const size = Math.round(BASE_FONT * zoom * 10) / 10;
    return { zoom, setZoom, size, lineHeight: Math.round(size * LINE_RATIO) };
  }, [setZoom, zoom]);
  return <SparkTextScaleContext.Provider value={value}>{children}</SparkTextScaleContext.Provider>;
}

export function useSparkTextScale() {
  return useContext(SparkTextScaleContext);
}

/** The text-size sheet the spark frame's "…" opens. */
export function SparkTextSizeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { zoom, setZoom } = useSparkTextScale();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.sheetLabel}>{t("wordSparks.textSize")}</Text>
      <ChordZoomBar zoom={zoom} onChange={setZoom} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 4,
  },
});

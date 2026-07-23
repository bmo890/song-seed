import React, { createContext, useContext, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { styles as appStyles } from "../../styles";
import { colors, radii } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { BottomSheet } from "./BottomSheet";
import { ChordZoomBar } from "../LyricsVersionScreen/components/chords/ChordZoomBar";
import { useTranslation } from "react-i18next";

/**
 * One shared "paper text" zoom for a Word Sparks exercise, so the words look
 * the same size on every step — and shrinking them buys real screen space on
 * the denser steps. The control is the same as Magpie's: an "Aa" header button
 * opening a slider sheet (ChordZoomBar).
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

export function SparkTextScaleProvider({ children }: { children: React.ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const value = useMemo<SparkTextScale>(() => {
    const size = Math.round(BASE_FONT * zoom * 10) / 10;
    return { zoom, setZoom, size, lineHeight: Math.round(size * LINE_RATIO) };
  }, [zoom]);
  return <SparkTextScaleContext.Provider value={value}>{children}</SparkTextScaleContext.Provider>;
}

export function useSparkTextScale() {
  return useContext(SparkTextScaleContext);
}

/** The header "Aa" button — opens a bottom sheet with the text-size slider. */
export function SparkTextSizeButton() {
  const { t } = useTranslation();
  const { zoom, setZoom } = useSparkTextScale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed ? appStyles.pressDown : null]}
        onPress={() => {
          haptic.tap();
          setOpen(true);
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t("wordSparks.textSize")}
      >
        <Text style={styles.glyph}>Aa</Text>
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetLabel}>{t("wordSparks.textSize")}</Text>
        <ChordZoomBar zoom={zoom} onChange={setZoom} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 15,
    color: colors.textStrong,
  },
  sheetLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
});

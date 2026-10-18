import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { hueToAccentHex } from "../../domain/workspaceTheme";
import { Slider } from "./Slider";

// The full hue circle at the same muted saturation and lightness every workspace
// accent uses, so the track shows exactly the colours a workspace can wear.
const STOPS = Array.from({ length: 13 }, (_, i) => ({
  offset: `${((i / 12) * 100).toFixed(1)}%`,
  color: hueToAccentHex(i * 30),
}));

type Props = {
  hue: number;
  onChange: (hue: number) => void;
};

/**
 * Pick a workspace's colour (rebuilt 2026-10-18 on the app's Slider): the same
 * paper thumb, the same scrub choreography (grab, a tick every 30°, light on
 * lift), a sideways drag the sheet's scroll can't steal, and VoiceOver adjust.
 * Only the track is its own: the accent rainbow.
 */
export function HueSlider({ hue, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <Slider
      value={hue}
      minimumValue={0}
      maximumValue={359}
      step={1}
      detent={30}
      fill={false}
      onValueChange={(next) => onChange(Math.round(next))}
      accessibilityLabel={t("modals.workspaceColor")}
      track={
        <Svg style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="workspaceHueTrack" x1="0" y1="0" x2="1" y2="0">
              {STOPS.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#workspaceHueTrack)" />
        </Svg>
      }
      style={styles.slider}
    />
  );
}

const styles = StyleSheet.create({
  slider: {
    marginVertical: 8,
  },
});

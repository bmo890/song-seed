import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { hslToHex } from "../../domain/workspaceTheme";
import { colors } from "../../design/tokens";

// Gradient stops across the full hue spectrum at the same muted S/L as accent colours
const STOPS = Array.from({ length: 13 }, (_, i) => ({
  offset: `${((i / 12) * 100).toFixed(1)}%`,
  color: hslToHex(i * 30, 38, 57),
}));

const THUMB_SIZE = 26;
const TRACK_HEIGHT = 28;
const BORDER_RADIUS = TRACK_HEIGHT / 2;

type Props = {
  hue: number;
  onChange: (hue: number) => void;
};

export function HueSlider({ hue, onChange }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);

  // Keep latest values available inside the PanResponder without recreating it
  const stateRef = useRef({ trackWidth: 0, onChange });
  stateRef.current.trackWidth = trackWidth;
  stateRef.current.onChange = onChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { trackWidth: w, onChange: cb } = stateRef.current;
        if (w <= 0) return;
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
        cb(Math.round((x / w) * 360));
      },
      onPanResponderMove: (evt) => {
        const { trackWidth: w, onChange: cb } = stateRef.current;
        if (w <= 0) return;
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
        cb(Math.round((x / w) * 360));
      },
    })
  ).current;

  const thumbLeft = trackWidth > 0
    ? (hue / 360) * trackWidth - THUMB_SIZE / 2
    : 0;

  return (
    <View style={sliderStyles.container}>
      <View
        style={sliderStyles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {/* Gradient fill via SVG */}
        <Svg style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="hueGrad" x1="0" y1="0" x2="1" y2="0">
              {STOPS.map((s) => (
                <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect
            width="100%"
            height="100%"
            fill="url(#hueGrad)"
            rx={BORDER_RADIUS}
            ry={BORDER_RADIUS}
          />
        </Svg>

        {/* Draggable thumb */}
        {trackWidth > 0 ? (
          <View
            style={[
              sliderStyles.thumb,
              {
                left: thumbLeft,
                borderColor: hslToHex(hue, 38, 57),
              },
            ]}
            pointerEvents="none"
          />
        ) : null}
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: BORDER_RADIUS,
    position: "relative",
    overflow: "visible",
  },
  thumb: {
    position: "absolute",
    top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 3,
    shadowColor: "#3D3732",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
});

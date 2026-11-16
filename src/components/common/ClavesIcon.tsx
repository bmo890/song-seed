import Svg, { Circle, G, Rect } from "react-native-svg";
import { colors } from "../../design/tokens";

/**
 * Claves, two round hardwood sticks crossed, each showing its cut end: the metronome's
 * Wood voice (founder, 2026-11-16). Drawn in the outline weight of the Ionicons beside
 * it, since no icon set has one. The front stick is filled with the sheet's paper so
 * it reads as lying across the other.
 */
export function ClavesIcon({ size = 16, color = colors.textStrong }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G stroke={color} strokeWidth={1.6} fill={colors.surface}>
        <G transform="rotate(34 12 12)">
          <Rect x={1.5} y={9.25} width={21} height={5.5} rx={2.75} />
          <Circle cx={19.75} cy={12} r={2.75} />
        </G>
        <G transform="rotate(-34 12 12)">
          <Rect x={1.5} y={9.25} width={21} height={5.5} rx={2.75} />
          <Circle cx={4.25} cy={12} r={2.75} />
        </G>
      </G>
    </Svg>
  );
}

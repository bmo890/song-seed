import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { getWorkspaceTheme } from "../../workspaceTheme";

type Props = {
  color?: string;
  name: string;
  size?: number;
};

/** Deterministic hash of a string → integer 0..max-1 */
function strHash(s: string, max: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % max;
}

/**
 * Circular marble-style avatar built from 3 overlapping circles via react-native-svg.
 * Pattern is deterministic — same name always produces the same layout.
 */
export function WorkspaceAvatar({ color, name, size = 36 }: Props) {
  const theme = getWorkspaceTheme(color);
  const r = size / 2;

  // Deterministic offsets based on name hash — gives each workspace a unique blob pattern
  const hash = strHash(name || "?", 100);
  const ox1 = ((hash * 7) % 40) - 20;   // -20..+19
  const oy1 = ((hash * 13) % 40) - 20;
  const ox2 = ((hash * 17) % 40) - 20;
  const oy2 = ((hash * 23) % 40) - 20;

  // Scale offsets to actual size
  const scale = size / 40;
  const cx1 = r + ox1 * scale;
  const cy1 = r + oy1 * scale;
  const cx2 = r + ox2 * scale;
  const cy2 = r + oy2 * scale;

  const blobR1 = size * 0.55;
  const blobR2 = size * 0.45;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: "hidden",
      }}
    >
      <Svg width={size} height={size}>
        {/* Background fill */}
        <Circle cx={r} cy={r} r={r} fill={theme.surface} />
        {/* Mid blob */}
        <Circle cx={cx1} cy={cy1} r={blobR1} fill={theme.tint} opacity={0.85} />
        {/* Accent blob */}
        <Circle cx={cx2} cy={cy2} r={blobR2} fill={theme.accent} opacity={0.25} />
      </Svg>
    </View>
  );
}

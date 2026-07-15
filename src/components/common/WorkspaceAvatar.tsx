import { View } from "react-native";
import Svg, { Circle, Ellipse, Polygon, Rect, Defs, RadialGradient, Stop, G } from "react-native-svg";
import { getWorkspaceTheme } from "../../domain/workspaceTheme";

type Props = {
  color?: string;
  name: string;
  size?: number;
  /** Override corner radius. Defaults to size/2 (circle). Pass e.g. 4 for a rounded square. */
  borderRadius?: number;
  /** A stored number that drives the blob pattern. When provided, decouples design from the title. */
  avatarKey?: number;
};

/**
 * Cheap but well-distributed pseudo-random float in [0, 1) from a base key + slot index.
 * Uses a multiplicative hash mix so adjacent slot values diverge quickly.
 */
function rnd(key: number, slot: number): number {
  let h = ((key ^ (slot * 2654435761)) >>> 0);
  h ^= h >>> 16;
  h = (h * 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

/** Convenience: rnd scaled to [min, max] */
function rng(key: number, slot: number, min: number, max: number): number {
  return min + rnd(key, slot) * (max - min);
}

/**
 * Circular marble-style avatar.
 * Design is driven by avatarKey when provided so it stays fixed even when the
 * workspace title changes, and can be independently randomized via refresh.
 * Falls back to a name-derived hash for workspaces that predate avatarKey.
 */
export function WorkspaceAvatar({ color, name, size = 36, borderRadius, avatarKey }: Props) {
  const theme = getWorkspaceTheme(color);
  const r = size / 2;
  const br = borderRadius ?? r;

  // Derive a stable integer key
  let key: number;
  if (avatarKey !== undefined) {
    key = avatarKey % 99991; // prime mod for better spread
  } else {
    let h = 0;
    const s = name || "?";
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    key = h % 99991;
  }

  // ── Large layered ellipses (marble/watercolor blobs) ─────────────────────
  // 6 ellipses, alternating between tint and accent fills, at random angles
  const ellipses = Array.from({ length: 6 }, (_, i) => ({
    cx:       rng(key, i * 11 + 1,  size * 0.05, size * 0.95),
    cy:       rng(key, i * 11 + 2,  size * 0.05, size * 0.95),
    rx:       rng(key, i * 11 + 3,  size * 0.28, size * 0.62),
    ry:       rng(key, i * 11 + 4,  size * 0.18, size * 0.44),
    rotation: rng(key, i * 11 + 5,  0,           180),
    opacity:  rng(key, i * 11 + 6,  0.18,        0.52),
    fill:     i % 3 === 2 ? theme.accent : i % 2 === 0 ? theme.tint : theme.surface,
  }));

  // ── Small accent flecks — each one randomly picks a shape ────────────────
  // 0–3 flecks so they stay memorable rather than busy
  const SHAPE_COUNT = 4; // circle | triangle | diamond | rect
  const fleckCount = Math.floor(rnd(key, 200) * 4); // 0, 1, 2, or 3
  const flecks = Array.from({ length: fleckCount }, (_, i) => ({
    cx:      rng(key, i * 8 + 70,  size * 0.06, size * 0.94),
    cy:      rng(key, i * 8 + 71,  size * 0.06, size * 0.94),
    s:       rng(key, i * 8 + 72,  size * 0.04, size * 0.11), // half-size / radius
    rotation:rng(key, i * 8 + 73,  0,           360),
    opacity: rng(key, i * 8 + 74,  0.28,        0.60),
    shape:   Math.floor(rnd(key, i * 8 + 75) * SHAPE_COUNT), // 0–3
  }));

  // Unique gradient ID per key so multiple avatars on screen don't collide
  const gradId = `wsa-${key}`;

  return (
    <View
      pointerEvents="none"
      style={{ width: size, height: size, borderRadius: br, overflow: "hidden" }}
    >
      <Svg width={size} height={size}>
        <Defs>
          {/* Soft radial glow — lighter at centre, fades to transparent */}
          <RadialGradient id={gradId} cx="42%" cy="38%" r="62%">
            <Stop offset="0%"   stopColor={theme.surface} stopOpacity={0.45} />
            <Stop offset="100%" stopColor={theme.bg}      stopOpacity={0}    />
          </RadialGradient>
        </Defs>

        {/* Base background */}
        <Circle cx={r} cy={r} r={r} fill={theme.bg} />

        {/* Layered ellipses — watercolour blobs at random angles */}
        {ellipses.map((e, i) => (
          <Ellipse
            key={i}
            cx={e.cx}
            cy={e.cy}
            rx={e.rx}
            ry={e.ry}
            fill={e.fill}
            opacity={e.opacity}
            transform={`rotate(${e.rotation}, ${e.cx}, ${e.cy})`}
          />
        ))}

        {/* Mineral flecks — circle, triangle, diamond, or rotated rect */}
        {flecks.map((f, i) => {
          const { cx, cy, s, rotation, opacity, shape } = f;
          const t = `rotate(${rotation}, ${cx}, ${cy})`;

          if (shape === 0) {
            // Circle
            return <Circle key={i} cx={cx} cy={cy} r={s} fill={theme.accent} opacity={opacity} />;
          }
          if (shape === 1) {
            // Equilateral triangle
            const pts = [
              `${cx},${cy - s}`,
              `${cx + s * 0.866},${cy + s * 0.5}`,
              `${cx - s * 0.866},${cy + s * 0.5}`,
            ].join(" ");
            return <Polygon key={i} points={pts} fill={theme.accent} opacity={opacity} transform={t} />;
          }
          if (shape === 2) {
            // Diamond (square rotated 45°)
            const pts = [
              `${cx},${cy - s}`,
              `${cx + s},${cy}`,
              `${cx},${cy + s}`,
              `${cx - s},${cy}`,
            ].join(" ");
            return <Polygon key={i} points={pts} fill={theme.accent} opacity={opacity} transform={t} />;
          }
          // Rotated rectangle
          return (
            <Rect
              key={i}
              x={cx - s * 0.9}
              y={cy - s * 0.45}
              width={s * 1.8}
              height={s * 0.9}
              rx={s * 0.15}
              fill={theme.accent}
              opacity={opacity}
              transform={t}
            />
          );
        })}

        {/* Radial highlight — adds depth without being heavy */}
        <Circle cx={r} cy={r} r={r} fill={`url(#${gradId})`} />
      </Svg>
    </View>
  );
}

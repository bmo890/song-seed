// ── Colour math ──────────────────────────────────────────────────────────────

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Convert a hue (0–360) to the muted accent hex used across the app. */
export function hueToAccentHex(hue: number): string {
  return hslToHex(hue, 38, 57);
}

/** Extract the hue from any hex colour string. */
export function hexToHue(hex: string): number {
  return hexToHsl(hex).h;
}

/** Compute a full WorkspaceTheme from any accent hex. */
export function computeWorkspaceTheme(accent: string): WorkspaceTheme {
  const { h, s } = hexToHsl(accent);
  const ms = Math.min(s, 42); // keep muted
  return {
    accent,
    tint:    hslToHex(h, Math.max(ms - 12, 8), 88),
    surface: hslToHex(h, Math.max(ms - 18, 5), 93),
    bg:      hslToHex(h, Math.max(ms - 24, 3), 97),
  };
}

// ── Legacy discrete palette (kept for backward-compat) ───────────────────────

export const WORKSPACE_COLORS = [
  "#B87D6B", // terracotta (default — matches app primary)
  "#7A9E8E", // sage
  "#7B8FAD", // slate
  "#A89B6E", // ochre
  "#8E7B9E", // plum
  "#6E8E7D", // forest
  "#9E7B6E", // rust
  "#C49A6C", // amber
  "#8B9E88", // mint
  "#9B8EA0", // lavender
  "#6B8EA0", // steel
  "#A07B8E", // mauve
  "#9E9A7A", // olive
  "#7B6E8E", // deep plum
  "#B87D8E", // dusty rose
] as const;

export type WorkspaceColor = typeof WORKSPACE_COLORS[number];

export type WorkspaceTheme = {
  bg: string;
  surface: string;
  tint: string;
  accent: string;
};

// Pre-computed tokens per legacy color — avoids runtime HSL math for known colours
export const WORKSPACE_THEME_MAP: Record<WorkspaceColor, WorkspaceTheme> = {
  "#B87D6B": { bg: "#fdf7f5", surface: "#f7ede9", tint: "#f0e2dc", accent: "#B87D6B" },
  "#7A9E8E": { bg: "#f4faf8", surface: "#e7f4f0", tint: "#d6ece6", accent: "#7A9E8E" },
  "#7B8FAD": { bg: "#f4f6fa", surface: "#e7ecf5", tint: "#d6dff0", accent: "#7B8FAD" },
  "#A89B6E": { bg: "#faf8f3", surface: "#f4f0e5", tint: "#ede7d4", accent: "#A89B6E" },
  "#8E7B9E": { bg: "#f8f4fb", surface: "#f0e8f6", tint: "#e5d8ef", accent: "#8E7B9E" },
  "#6E8E7D": { bg: "#f4faf7", surface: "#e7f4ed", tint: "#d6ede4", accent: "#6E8E7D" },
  "#9E7B6E": { bg: "#faf5f4", surface: "#f5ece9", tint: "#ede0da", accent: "#9E7B6E" },
  "#C49A6C": { bg: "#fcfaf7", surface: "#f6f0e6", tint: "#ede2ce", accent: "#C49A6C" },
  "#8B9E88": { bg: "#f5faf5", surface: "#e8f3e7", tint: "#d7ebd5", accent: "#8B9E88" },
  "#9B8EA0": { bg: "#f8f6fa", surface: "#f0ecf5", tint: "#e3d9ec", accent: "#9B8EA0" },
  "#6B8EA0": { bg: "#f3f7fa", surface: "#e4eef5", tint: "#d1e1ed", accent: "#6B8EA0" },
  "#A07B8E": { bg: "#faf5f8", surface: "#f4e8f1", tint: "#e9d5e4", accent: "#A07B8E" },
  "#9E9A7A": { bg: "#fafaf4", surface: "#f3f2e4", tint: "#e7e5d2", accent: "#9E9A7A" },
  "#7B6E8E": { bg: "#f7f5fa", surface: "#ede9f5", tint: "#dfd8ed", accent: "#7B6E8E" },
  "#B87D8E": { bg: "#fdf5f8", surface: "#f8e8ee", tint: "#f0d6e0", accent: "#B87D8E" },
};

export const DEFAULT_WORKSPACE_COLOR: WorkspaceColor = "#B87D6B";

export function getWorkspaceTheme(color?: string): WorkspaceTheme {
  // Check legacy map first for exact match
  if (color && color in WORKSPACE_THEME_MAP) {
    return WORKSPACE_THEME_MAP[color as WorkspaceColor];
  }
  // Dynamically compute for any other hex
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
    return computeWorkspaceTheme(color);
  }
  return WORKSPACE_THEME_MAP[DEFAULT_WORKSPACE_COLOR];
}

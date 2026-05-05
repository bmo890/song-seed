export const WORKSPACE_COLORS = [
  "#824f3f", // terracotta (default — matches app accent)
  "#4f7a6e", // sage
  "#5c6b8a", // slate blue
  "#7a6e4f", // warm ochre
  "#6b5c7a", // plum
  "#4f6b5c", // forest
  "#7a5c4f", // rust
] as const;

export type WorkspaceColor = typeof WORKSPACE_COLORS[number];

export type WorkspaceTheme = {
  bg: string;
  surface: string;
  tint: string;
  accent: string;
};

// Pre-computed tokens per color — avoids runtime HSL math
export const WORKSPACE_THEME_MAP: Record<WorkspaceColor, WorkspaceTheme> = {
  "#824f3f": { bg: "#fdf6f4", surface: "#f7ede9", tint: "#efdedb", accent: "#824f3f" },
  "#4f7a6e": { bg: "#f4faf8", surface: "#e7f5f1", tint: "#d6ede8", accent: "#4f7a6e" },
  "#5c6b8a": { bg: "#f4f6fa", surface: "#e7ecf5", tint: "#d6deee", accent: "#5c6b8a" },
  "#7a6e4f": { bg: "#faf8f4", surface: "#f5f1e7", tint: "#ede7d6", accent: "#7a6e4f" },
  "#6b5c7a": { bg: "#f8f4fa", surface: "#f1e7f5", tint: "#e7d6ee", accent: "#6b5c7a" },
  "#4f6b5c": { bg: "#f4faf7", surface: "#e7f5ed", tint: "#d6eee2", accent: "#4f6b5c" },
  "#7a5c4f": { bg: "#faf6f4", surface: "#f5ede7", tint: "#eee0d6", accent: "#7a5c4f" },
};

export const DEFAULT_WORKSPACE_COLOR: WorkspaceColor = "#824f3f";

export function getWorkspaceTheme(color?: string): WorkspaceTheme {
  return (
    WORKSPACE_THEME_MAP[color as WorkspaceColor] ??
    WORKSPACE_THEME_MAP[DEFAULT_WORKSPACE_COLOR]
  );
}

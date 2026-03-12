export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  round: 999,
  drawer: 26,
} as const;

export const colors = {
  page: "#f4f5f7",
  surface: "#ffffff",
  surfaceMuted: "#f8fafc",
  surfaceSubtle: "#f1f5f9",
  surfaceSelected: "#f3f4f6",
  borderSubtle: "#e2e8f0",
  borderMuted: "#dbe2ea",
  borderStrong: "#d1d5db",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  textStrong: "#334155",
  chipText: "#4b5563",
  iconMuted: "#475569",
  accentSuccessBg: "#dcfce7",
  accentSuccessText: "#166534",
} as const;

export const text = {
  pageTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: colors.textStrong,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  body: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  supporting: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600" as const,
  },
  chip: {
    fontSize: 10,
    color: colors.chipText,
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  control: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  drawer: {
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 12,
  },
} as const;

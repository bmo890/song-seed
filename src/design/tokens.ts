export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  xs:     2,    // almost square
  sm:     4,    // cards, inputs
  md:     6,    // chips, pills
  lg:     8,    // modals
  xl:     12,   // bottom sheets
  round:  999,  // circle/pill
  drawer: 20,   // drawer edge
} as const;

export const colors = {
  // Surface hierarchy
  page:             "#FDFBF7",  // base page — warm unbleached paper
  surface:          "#FFFFFF",  // lifted/floating elements
  surfaceContainer: "#F4F1ED",  // sub-nav, utility backgrounds
  surfaceHigh:      "#EDE9E4",  // hover states, secondary cards

  // Text
  textPrimary:   "#1b1c1a",  // warm charcoal
  textSecondary: "#84736f",
  textMuted:     "#a89994",
  textStrong:    "#524440",

  // Primary — Nocturne terracotta
  primary:   "#B87D6B",
  onPrimary: "#FFFFFF",

  // Technical lines (graph paper feel)
  borderSubtle: "#E8E4DF",
  borderMuted:  "#D7C2BD",

  // Legacy aliases (kept for compatibility)
  chipText:       "#524440",
  iconMuted:      "#84736f",

  // Deprecated — kept for component compatibility; prefer semantic names above
  surfaceMuted:   "#F4F1ED",   // → surfaceContainer
  surfaceSubtle:  "#EDE9E4",   // → surfaceHigh
  surfaceSelected:"#EDE9E4",   // → surfaceHigh
  borderStrong:   "#C8C4BF",   // slightly stronger warm line
  accentSuccessBg:   "#dcfce7",
  accentSuccessText: "#166534",
} as const;

export const text = {
  pageTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 48,
    lineHeight: 48,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 22,
    color: colors.textPrimary,
  },
  cardTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1.0,
    textTransform: "uppercase" as const,
  },
  body: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textPrimary,
  },
  supporting: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
  },
  caption: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  annotation: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: "#3D3732",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardActive: {
    shadowColor: "#B87D6B",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  control: {
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  drawer: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

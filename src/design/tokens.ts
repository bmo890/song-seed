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
  // Deep terracotta — text-safe companion to primary (small accent text, icons,
  // filled controls that need contrast on paper). The app's original accent.
  primaryDeep: "#824F3F",
  /** The tonal terracotta WASH behind an active/selected control — the "primary" tier of
   *  the button language, paired with primaryDeep text or icon. Was written out as a bare
   *  #F2E4DF in six places before it had a name. */
  primarySurface: "#F2E4DF",

  /**
   * Section ink (locked 2026-08-01) — one colour per structural role, stable across every
   * song, so "the chorus is the terracotta one" is learned once and then read at a glance
   * mid-playback. HUE carries the role; lightness and chroma are FIXED (OKLCH L 0.545 /
   * C 0.098) so the set reads as one family and no part shouts over another.
   *
   * That constancy is the whole fix. The retired palette was not wrong to use hue — it was
   * wrong to hand-pick eight hexes whose lightness ranged 0.52-0.68 and chroma 0.04-0.16,
   * which is why its chorus screamed (a saturated red, reading as an error on warm paper)
   * while its outro vanished. A one-hue three-weight ramp replaced it briefly and was worse:
   * sections are a taxonomy (what kind of part), not a ramp (how loud), so verse and bridge
   * collapsed onto the same ink. See docs/product-plan/full-player-audit.md B2.
   *
   * Every value clears 4.5:1 against both its white label and the page.
   */
  sectionIntro:     "#428051", // sage — a beginning
  sectionVerse:     "#856E20", // ochre — the body of the song
  sectionPrechorus: "#98622D", // amber, leaning toward the chorus it feeds
  sectionChorus:    "#A25853", // terracotta — the peak wears the house accent
  sectionBridge:    "#576DA9", // indigo — the departure, furthest from the chorus
  sectionSolo:      "#8B5C92", // plum — expressive
  sectionOutro:     "#0D7C99", // slate blue — settling
  sectionCustom:    "#008279", // teal — the default for a part you name yourself

  /** Stage ramp (locked 2026-07-27) — the two intermediate steps between
   *  `textMuted` (Idea, nothing invested yet) and `primaryDeep` (Song, finished).
   *  One warm hue gaining saturation and depth, so the COLOR is the progression.
   *  Only the stage mark uses these. */
  stageMid:  "#B08B72",  // Rough
  stageLate: "#A8654B",  // Close

  // Playhead / live-position indicator (transport lines, scrub cursors)
  playhead: "#D95B56",

  // Record / live-capture affordance — the record button and "recording now" dots.
  // Red is worth keeping (it's the one universal transport convention, and the app's
  // terracotta is too close to it to substitute without confusion), but it has to be
  // OUR red: warm brick, paper-friendly. Distinct from `danger` because recording is
  // not destructive, and from `playhead` which marks position rather than capture.
  record:   "#C0453B",
  onRecord: "#FFFFFF",
  /** Blush behind record-state chrome (the recording dock's surface, its pause pill).
   *  Warm — the old #fff1f2/#fff7f7 were cold pinks that fought the paper. */
  recordSurface: "#FCF2F0",
  /** Hairline for record-state chrome — the warm companion to the old #fecaca. */
  recordBorder:  "#EBD3CE",

  // Destructive — warm brick red (delete/remove actions, destructive dialog buttons)
  danger:   "#A8443A",
  onDanger: "#FFFFFF",
  /** Blush behind destructive chrome (danger buttons, "unavailable" pills). */
  dangerSurface: "#FBEFEC",

  // Tuner meter — the one place the app speaks in three states. Muted, earthy
  // relatives of the palette; every coloured element on the tuner screen
  // (needle, cents box, status dot and label, arc) reads from these three.
  /** Far off (more than 16 cents): muted earthy red. */
  tuneFar:  "#A04545",
  /** Almost there (5–16 cents): earthy amber. */
  tuneNear: "#C07840",
  /** In tune (within 5 cents): muted sage. */
  tuneIn:   "#4A7C5E",

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
    fontFamily: "Lora_500Medium",
    fontSize: 48,
    lineHeight: 48,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 22,
    color: colors.textPrimary,
  },
  cardTitle: {
    fontFamily: "Lora_500Medium",
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

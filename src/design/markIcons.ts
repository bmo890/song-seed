import type { Ionicons } from "@expo/vector-icons";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The glyph for a PIN — a mark dropped at one moment on a take. One pushpin,
 * app-wide (founder, 2026-10-13: it was a flag in some places, which read as
 * "report" or "finish line", not as something you stick into the tape).
 *
 * Filled for a pin that exists; outline for the control that drops one and for
 * the toast that confirms it. Never a flag, a bookmark or a map marker.
 */
export const PIN_ICON: IconName = "pin";
export const PIN_ICON_OUTLINE: IconName = "pin-outline";

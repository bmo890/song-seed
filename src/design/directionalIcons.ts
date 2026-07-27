import { I18nManager } from "react-native";
import type { Ionicons } from "@expo/vector-icons";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Glyphs whose meaning IS a direction — "back", "forward", "undo", "next". In
 * an RTL layout the reading axis flips, so these must flip with it: a back
 * chevron in Hebrew points right, and undo winds the other way.
 *
 * Deliberately NOT here:
 *  - play / pause / record / skip — transport is about *time*, which always
 *    runs left → right. Mirroring them would say the audio plays backwards.
 *  - chevron-up / chevron-down, expand/collapse — the vertical axis never flips.
 *  - share / open — Ionicons has no mirrored twin, and the meaning survives.
 *
 * Some rows opt OUT of mirroring entirely (the transport strip, the chord
 * staff). Those set `direction: "ltr"` on the container; icons inside them must
 * be passed through raw, not through this map — see `docs/design-system.md`
 * "Direction policy".
 */
const MIRRORED: Partial<Record<IconName, IconName>> = {
  "chevron-back": "chevron-forward",
  "chevron-forward": "chevron-back",
  "chevron-back-outline": "chevron-forward-outline",
  "chevron-forward-outline": "chevron-back-outline",
  "arrow-back": "arrow-forward",
  "arrow-forward": "arrow-back",
  "arrow-back-outline": "arrow-forward-outline",
  "arrow-forward-outline": "arrow-back-outline",
  "arrow-undo": "arrow-redo",
  "arrow-redo": "arrow-undo",
  "arrow-undo-outline": "arrow-redo-outline",
  "arrow-redo-outline": "arrow-undo-outline",
  "caret-back": "caret-forward",
  "caret-forward": "caret-back",
  "caret-back-outline": "caret-forward-outline",
  "caret-forward-outline": "caret-back-outline",
  "return-up-back": "return-up-forward",
  "return-up-forward": "return-up-back",
};

/**
 * Resolve a logical icon name to the glyph that actually points the right way.
 * A no-op in LTR, so call sites can use it unconditionally.
 */
export function dirIcon(name: IconName): IconName {
  if (!I18nManager.isRTL) return name;
  return MIRRORED[name] ?? name;
}

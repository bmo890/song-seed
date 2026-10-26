import React from "react";
import {
  I18nManager,
  Platform,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";
import type { UiDirection } from "./languages";
import type { ContentDirection } from "../types";
export type { ContentDirection } from "../types";

const RTL_STRONG = /[\u0590-\u05FF\u0600-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_STRONG = /[A-Za-z\u00C0-\u02AF\u0370-\u052F]/;

export function detectTextDirection(value: string): UiDirection | null {
  for (const character of value.normalize("NFC")) {
    if (RTL_STRONG.test(character)) return "rtl";
    if (LTR_STRONG.test(character)) return "ltr";
  }
  return null;
}

export function resolveContentDirection(
  value: string,
  override: ContentDirection = "auto",
  fallback: UiDirection = I18nManager.isRTL ? "rtl" : "ltr"
): UiDirection {
  if (override !== "auto") return override;
  return detectTextDirection(value) ?? fallback;
}

/**
 * How Hebrew lays out in this app (measured on the simulator, 2026-10-26, new
 * architecture): `textAlign: "left" | "right"` IS swapped in RTL, but absolute
 * insets (`left`/`right`) and padding are NOT (margins follow the same rule).
 * They stay physical.
 * Logical `start`/`end` (and `paddingStart`, `marginEnd`…) follow the
 * language. A `direction: "ltr"` subtree lays its rows out left to right.
 *
 * So: for a position that should mirror, use `start`/`end`; for one that must
 * not (a mark on the timeline), `left`/`right` already mean the physical side.
 * The helpers below exist for text alignment, which does get swapped, and for
 * the few places that pick a physical layout edge by name.
 */
const SWAPS_LEFT_AND_RIGHT = I18nManager.getConstants().doLeftAndRightSwapInRTL;

function physical<T extends "left" | "right">(edge: T): "left" | "right" {
  if (!I18nManager.isRTL || !SWAPS_LEFT_AND_RIGHT) return edge;
  return edge === "left" ? "right" : "left";
}

/**
 * Pin a row's visual order to LTR regardless of language direction.
 *
 * For rows that map onto the TIME AXIS — transport buttons beside a reel that still
 * runs left-to-right, an inspector's start/end chips, a nudge pair. Mirroring those
 * would put "jump to the start" on the right while the start of the audio sits at the
 * left, which is the one place mirroring makes the UI wrong rather than native.
 * Language rows mirror normally; this is only for notation.
 */
export const ltrRow: { flexDirection: "row" | "row-reverse" } = {
  flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
};

/**
 * A playback row (founder, 2026-10-26): its play key sits on the LEFT in every
 * language, because play points into time and time runs left to right. Pin the
 * row with `playRowFrame` and wrap everything after the play key in
 * `playRowRest`, which hands the words back to the language: in Hebrew the title
 * reads from the right and trailing times sit beside the play key.
 */
export const playRowFrame = { direction: "ltr" as const };
export const playRowRest = {
  flex: 1,
  minWidth: 0,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  direction: (I18nManager.isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
};

/**
 * Lay a row out in the CONTENT's direction, whatever the app's. RN already mirrors
 * `row` in the Hebrew app, so a plain `row-reverse` for Hebrew content flipped twice
 * and put a Hebrew lyric's strips left-to-right there (overnight check 2026-10-20).
 */
export function contentRow(direction: UiDirection): { flexDirection: "row" | "row-reverse" } {
  return { flexDirection: (direction === "rtl") === I18nManager.isRTL ? "row" : "row-reverse" };
}

/** Align text to the edge the content's script starts at, whatever the app's direction. */
export function contentTextAlign(direction: UiDirection): { textAlign: "left" | "right" } {
  return { textAlign: physicalTextAlign(direction === "rtl" ? "right" : "left") };
}

/**
 * A signed number ("+2", "−3", "-12") shown in Hebrew: the bidi algorithm moves
 * a leading sign to the far side of the digits ("2+"). A left-to-right mark
 * glues the sign to its digits; the right-to-left mark before it keeps the line
 * itself reading from the right ("+2 ח״ט", number first). A no-op in LTR.
 */
export function signedNumberText(value: string): string {
  return I18nManager.isRTL ? `\u200F\u200E${value}` : value;
}

/** The style key to use when you mean the physical left/right edge for an
 *  inset, padding or margin. Those are not swapped here, so it is the edge
 *  itself; kept so call sites say what they mean. */
export function physicalEdge(edge: "left" | "right"): "left" | "right" {
  return edge;
}

/** The `textAlign` value to use when you mean physically left/right. */
export function physicalTextAlign(edge: "left" | "right"): "left" | "right" {
  return physical(edge);
}

/**
 * Which edge user content sits on (founder ruling 2026-09-11).
 *
 * - `"ui"` — the app's start edge. A Hebrew collection name in an English app
 *   sits on the left with the chrome around it; an English title in the Hebrew
 *   app sits on the right. The STRING keeps its own writing direction, so its
 *   runs still read correctly. This is the default: titles, names, chips, rows,
 *   single-line fields.
 * - `"content"` — the edge the script starts at. For paragraphs a reader
 *   actually reads (lyrics, notes, a book page, chart text) and multi-line
 *   editors, where a right-to-left paragraph pinned to the left edge is wrong
 *   typography.
 */
export type ContentAlign = "ui" | "content";

export function contentDirectionStyle(direction: UiDirection, align: ContentAlign = "content"): TextStyle {
  const edge =
    align === "content"
      ? direction === "rtl" ? "right" : "left"
      : I18nManager.isRTL ? "right" : "left";
  return {
    textAlign: physicalTextAlign(edge),
    writingDirection: direction,
  };
}

type UserTextProps = TextProps & {
  value?: string;
  direction?: ContentDirection;
  fallbackDirection?: UiDirection;
  /** Defaults to `"ui"`; pass `"content"` for paragraphs. */
  align?: ContentAlign;
};

export function UserText({ value, direction = "auto", fallbackDirection, align = "ui", style, children, ...props }: UserTextProps) {
  const source = value ?? (typeof children === "string" ? children : "");
  const resolved = resolveContentDirection(source, direction, fallbackDirection);
  return <Text {...props} style={[contentDirectionStyle(resolved, align), style]}>{children}</Text>;
}

/**
 * A text field's edge, said physically. Text swaps left/right in the Hebrew app
 * (so `physical()` pre-swaps it), but a multi-line field on iOS does not: a
 * Hebrew draft sat on the LEFT of the Cut-Up page in the Hebrew app
 * (2026-10-20). Fields get the edge they mean.
 */
function inputEdgeStyle(direction: UiDirection, align: ContentAlign): TextStyle | null {
  if (Platform.OS !== "ios") return null;
  const edge =
    align === "content"
      ? direction === "rtl" ? "right" : "left"
      : I18nManager.isRTL ? "right" : "left";
  return { textAlign: edge };
}

type UserTextInputProps = TextInputProps & {
  direction?: ContentDirection;
  fallbackDirection?: UiDirection;
  /** Defaults to `"content"` for multiline editors and `"ui"` for single-line fields. */
  align?: ContentAlign;
};

export const UserTextInput = React.forwardRef<TextInput, UserTextInputProps>(function UserTextInput(
  { value, defaultValue, direction = "auto", fallbackDirection, align, style, ...props },
  ref
) {
  const source = value ?? defaultValue ?? "";
  const resolved = resolveContentDirection(source, direction, fallbackDirection);
  const resolvedAlign: ContentAlign = align ?? (props.multiline ? "content" : "ui");
  return (
    <TextInput
      ref={ref}
      {...props}
      value={value}
      defaultValue={defaultValue}
      style={[contentDirectionStyle(resolved, resolvedAlign), inputEdgeStyle(resolved, resolvedAlign), style]}
    />
  );
});

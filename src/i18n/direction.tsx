import React from "react";
import {
  I18nManager,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";
import type { UiDirection } from "./locale";
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
 * React Native swaps `left` and `right` in styles when the app is in RTL —
 * `I18nManager.doLeftAndRightSwapInRTL`, on by default — so that layouts written
 * for LTR mirror for free. It applies to `textAlign` and to absolute `left` /
 * `right` too, and it keys off the GLOBAL direction, so a `style={{direction:
 * "ltr"}}` subtree does NOT opt out.
 *
 * That's the right default for chrome and the wrong one for anything whose
 * direction is decided by its CONTENT rather than by the app's language: a
 * Hebrew note inside an English UI, an English lyric inside a Hebrew one, or a
 * chord anchored to a monospace column. These two helpers ask for a physical
 * edge and pre-invert it so RN's swap lands on the side we actually meant.
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

/** The style key to use when you mean the physical left/right edge. */
export function physicalEdge(edge: "left" | "right"): "left" | "right" {
  return physical(edge);
}

/** The `textAlign` value to use when you mean physically left/right. */
export function physicalTextAlign(edge: "left" | "right"): "left" | "right" {
  return physical(edge);
}

export function contentDirectionStyle(direction: UiDirection): TextStyle {
  return {
    textAlign: physicalTextAlign(direction === "rtl" ? "right" : "left"),
    writingDirection: direction,
  };
}

type UserTextProps = TextProps & {
  value?: string;
  direction?: ContentDirection;
  fallbackDirection?: UiDirection;
};

export function UserText({ value, direction = "auto", fallbackDirection, style, children, ...props }: UserTextProps) {
  const source = value ?? (typeof children === "string" ? children : "");
  const resolved = resolveContentDirection(source, direction, fallbackDirection);
  return <Text {...props} style={[contentDirectionStyle(resolved), style]}>{children}</Text>;
}

type UserTextInputProps = TextInputProps & {
  direction?: ContentDirection;
  fallbackDirection?: UiDirection;
};

export const UserTextInput = React.forwardRef<TextInput, UserTextInputProps>(function UserTextInput(
  { value, defaultValue, direction = "auto", fallbackDirection, style, ...props },
  ref
) {
  const source = value ?? defaultValue ?? "";
  const resolved = resolveContentDirection(source, direction, fallbackDirection);
  return <TextInput ref={ref} {...props} value={value} defaultValue={defaultValue} style={[contentDirectionStyle(resolved), style]} />;
});

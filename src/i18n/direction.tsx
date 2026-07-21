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

export function contentDirectionStyle(direction: UiDirection): TextStyle {
  return {
    textAlign: direction === "rtl" ? "right" : "left",
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

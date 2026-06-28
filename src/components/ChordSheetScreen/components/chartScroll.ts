import { createContext, useContext, useRef } from "react";
import { findNodeHandle, type TextInput } from "react-native";

/** A host-provided scroller that brings a native input node above the keyboard. */
export type ScrollInputIntoView = (node: number | null) => void;

const ChartScrollContext = createContext<ScrollInputIntoView | null>(null);
export const ChartScrollProvider = ChartScrollContext.Provider;

/**
 * Attach the returned `ref`/`onFocus` to an inline chart TextInput (a section
 * note or a text block) so focusing it scrolls it above the keyboard instead of
 * being covered. No-ops when no host scroller is provided.
 */
export function useScrollIntoViewOnFocus() {
  const scrollIntoView = useContext(ChartScrollContext);
  const ref = useRef<TextInput>(null);
  const onFocus = () => scrollIntoView?.(findNodeHandle(ref.current));
  return { ref, onFocus };
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from "react";
import { Keyboard, type TextInput } from "react-native";

/** Brings a focused inline chart input above the keyboard. */
export type ScrollToInput = (inputRef: RefObject<any>) => void;

const ChartScrollContext = createContext<ScrollToInput | null>(null);
export const ChartScrollProvider = ChartScrollContext.Provider;

/** Attach the returned `ref`/`onFocus` to an inline chart TextInput (a section
 * note or a text block) so focusing it scrolls it above the keyboard. No-ops
 * when no host scroller is provided. */
export function useScrollIntoViewOnFocus() {
  const scrollToInput = useContext(ChartScrollContext);
  const ref = useRef<TextInput>(null);
  const onFocus = useCallback(() => scrollToInput?.(ref), [scrollToInput]);
  return { ref, onFocus };
}

const SAFE_GAP = 56;
type MeasureCb = (x: number, y: number, width: number, height: number) => void;

/**
 * Host helper for keyboard-safe editing. Returns:
 *  - `keyboardHeight`: add it to the scroll view's bottom padding so there's
 *    room to scroll the last fields up. Necessary under Android edge-to-edge
 *    (Expo SDK 54+) where the window no longer resizes for the keyboard, so
 *    KeyboardAvoidingView / adjustResize don't make room on their own.
 *  - `scrollToInput`: on focus, measures the input against the keyboard's top
 *    edge and drives the scroll view's imperative `scrollTo` to lift it above
 *    the keyboard (the ScrollResponder keyboard helper no-ops on Fabric).
 *
 * `scrollTo` receives an absolute content offset; `getOffset` returns the
 * current one.
 */
export function useChartKeyboardScroller(opts: {
  scrollTo: (y: number) => void;
  getOffset: () => number;
}): { scrollToInput: ScrollToInput; keyboardHeight: number } {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const kbTop = useRef(Number.POSITIVE_INFINITY); // screen-Y of the keyboard's top edge
  const pending = useRef<RefObject<any> | null>(null);

  const apply = useCallback(() => {
    const node = pending.current?.current as { measureInWindow?: (cb: MeasureCb) => void } | null;
    if (!node?.measureInWindow || !Number.isFinite(kbTop.current)) return;
    node.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h + SAFE_GAP - kbTop.current;
      if (overlap > 0) optsRef.current.scrollTo(optsRef.current.getOffset() + overlap);
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      kbTop.current = e.endCoordinates?.screenY ?? Number.POSITIVE_INFINITY;
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
      // Let the bottom-padding re-render + layout settle, then scroll the field in.
      setTimeout(apply, 70);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      kbTop.current = Number.POSITIVE_INFINITY;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [apply]);

  const scrollToInput = useCallback<ScrollToInput>(
    (inputRef) => {
      pending.current = inputRef;
      if (Number.isFinite(kbTop.current)) apply(); // keyboard already up (switching fields)
    },
    [apply]
  );

  return { scrollToInput, keyboardHeight };
}

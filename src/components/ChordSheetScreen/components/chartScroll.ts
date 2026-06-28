import { createContext, useCallback, useContext, useEffect, useRef, type RefObject } from "react";
import { Keyboard, Platform, type TextInput } from "react-native";

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

const SAFE_GAP = 24;

/**
 * Host helper: tracks the keyboard and returns a `ScrollToInput` that scrolls a
 * focused input above the keyboard. The old ScrollResponder keyboard helper
 * no-ops on the New Architecture, so we measure the input against the keyboard's
 * top edge and drive the scroll view's imperative `scrollTo` ourselves.
 *
 * `scrollTo` receives an absolute content offset; `getOffset` returns the
 * current one.
 */
export function useChartKeyboardScroller(opts: {
  scrollTo: (y: number) => void;
  getOffset: () => number;
}): ScrollToInput {
  const optsRef = useRef(opts);
  optsRef.current = opts;
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
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => {
      kbTop.current = e.endCoordinates?.screenY ?? Number.POSITIVE_INFINITY;
      // Let the keyboard frame settle before measuring/scrolling.
      setTimeout(apply, 60);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      kbTop.current = Number.POSITIVE_INFINITY;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [apply]);

  return useCallback(
    (inputRef) => {
      pending.current = inputRef;
      if (Number.isFinite(kbTop.current)) apply(); // keyboard already up (switching fields)
    },
    [apply]
  );
}

type MeasureCb = (x: number, y: number, width: number, height: number) => void;

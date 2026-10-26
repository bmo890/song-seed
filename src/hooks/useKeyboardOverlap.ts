import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, type View } from "react-native";

/**
 * How far the on-screen keyboard covers a view, in points (0 while it is down).
 *
 * Measured, not assumed: the view's bottom in the window against the keyboard's top.
 * Android draws edge to edge (app.json), and there the window no longer shrinks for the
 * keyboard, so a writing surface that relied on it sat under the keys with nothing to
 * scroll (founder, 2026-10-26). Pad the surface's bottom by this and it ends at the keys.
 */
export function useKeyboardOverlap(viewRef: React.RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);
  const liveRef = useRef(true);

  useEffect(() => {
    liveRef.current = true;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      const view = viewRef.current;
      if (!view) return;
      view.measureInWindow((_x, y, _width, height) => {
        if (!liveRef.current) return;
        // The padding goes INSIDE the measured view, so its frame never changes and a
        // second show (the keyboard switching languages) measures the same bottom.
        setOverlap(Math.max(0, Math.round(y + height - keyboardTop)));
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => setOverlap(0));
    return () => {
      liveRef.current = false;
      show.remove();
      hide.remove();
    };
  }, [viewRef]);

  return overlap;
}

import { useEffect, useState } from "react";

/**
 * Delays creating a Skia <Canvas> (a native GPU TextureView) until after the host screen's
 * push/navigation transition has settled.
 *
 * Mounting a Skia surface mid-transition can crash the hardware draw on some Android devices
 * — notably Samsung One UI, which throws
 *   `IllegalStateException: <parent> contains null child at index N ... dispatchGetDisplayList`
 * when the view tree mutates during the transition's display-list traversal (stock Android
 * silently tolerates it). The visualizer's container view stays mounted so layout/measurement
 * is unaffected; only the GPU surface waits out the transition.
 *
 * The default delay comfortably outlasts react-native-screens' push animations
 * (the Player uses ~260ms; platform defaults are ~300–350ms).
 */
export function useDeferredSkiaMount(delayMs = 400): boolean {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setReady(true), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs]);
    return ready;
}

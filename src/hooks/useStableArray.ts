import { useRef } from "react";

/**
 * Returns the PREVIOUS array while the next one holds the same elements in the same
 * order. Store writes hand every subscriber a fresh array even when the slice it cares
 * about did not change (an edit in another collection, a draft idea the list filters
 * out); without this, every memo downstream recomputes and the list re-renders all of
 * its cells for nothing. Derived in render, never from an effect.
 */
export function useStableArray<T>(next: T[]): T[] {
  const ref = useRef(next);
  const prev = ref.current;
  if (prev !== next) {
    const same = prev.length === next.length && prev.every((value, index) => value === next[index]);
    if (!same) ref.current = next;
  }
  return ref.current;
}

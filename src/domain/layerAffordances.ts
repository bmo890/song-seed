/**
 * What a take's layers offer in the player. A received parcel's take (until Keep)
 * or an archived one plays and reads, never edits (decision B, 2026-11-02): Solo is
 * pure listening (the main transport's solo mix, never saved) and stays; Mute is
 * saved on the layer, so it goes with the layer's sheet (level, tone, timing,
 * rename, remove) and the lanes' foot (merge, combine). The store refuses those
 * writes anyway; the controls must not offer what silently does nothing.
 */
export type LayerAffordances = {
  solo: boolean;
  mute: boolean;
  openSheet: boolean;
  mergeAndCombine: boolean;
};

export function layerAffordances(readOnly: boolean): LayerAffordances {
  return { solo: true, mute: !readOnly, openSheet: !readOnly, mergeAndCombine: !readOnly };
}

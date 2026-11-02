import { layerAffordances } from "../layerAffordances";

/**
 * Round-1 leftover (decision B): in a received parcel the player's layer sheet still
 * offered gain, nudge, tone, mute, rename, remove and merge, and the store silently
 * refused them. Read-only, a take's layers offer listening (Solo) only.
 */
describe("a take's layer controls", () => {
  it("in a parcel or an archive: Solo only", () => {
    expect(layerAffordances(true)).toEqual({ solo: true, mute: false, openSheet: false, mergeAndCombine: false });
  });

  it("in your own workspace: everything", () => {
    expect(layerAffordances(false)).toEqual({ solo: true, mute: true, openSheet: true, mergeAndCombine: true });
  });
});

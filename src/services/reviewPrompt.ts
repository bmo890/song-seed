import { useStore } from "../state/useStore";
import { shouldRequestReview } from "../domain/firstRun";

/**
 * Store-review prompt, fired after a positive moment (a saved clip). The decision
 * (enough clips, mature enough install, not asked too recently) is the pure
 * `shouldRequestReview`; this wires it to live store state and the OS API.
 *
 * expo-store-review is loaded lazily so a build without it (or Expo Go) simply
 * no-ops instead of failing the save flow. The OS itself decides whether a dialog
 * actually appears — we only control WHEN we ask.
 */

let requestingReview = false;

function countSavedClips(): number {
  return useStore
    .getState()
    .workspaces.reduce(
      (sum, workspace) => sum + workspace.ideas.reduce((acc, idea) => acc + idea.clips.length, 0),
      0
    );
}

/** Call after a save completes. Cheap + guarded — safe to call on every save. */
export async function maybeRequestReviewAfterSave(): Promise<void> {
  if (requestingReview) return;

  const state = useStore.getState();
  if (
    !shouldRequestReview({
      savedClipCount: countSavedClips(),
      firstLaunchAt: state.firstLaunchAt,
      reviewPromptShownAt: state.reviewPromptShownAt,
      now: Date.now(),
    })
  ) {
    return;
  }

  requestingReview = true;
  try {
    const StoreReview = require("expo-store-review") as typeof import("expo-store-review");
    const available = await StoreReview.isAvailableAsync().catch(() => false);
    if (!available) return;
    // Mark BEFORE requesting so a rapid second save can't double-ask within the cooldown.
    useStore.getState().setReviewPromptShownAt(Date.now());
    await StoreReview.requestReview();
  } catch {
    // No expo-store-review in this build, or the OS declined — never surface to the user.
  } finally {
    requestingReview = false;
  }
}

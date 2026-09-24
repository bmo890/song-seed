import { InteractionManager } from "react-native";

/**
 * Run background JS work once the current gesture or animation has finished — but
 * never later than `deadlineMs`. Serialising a workspace shard, flushing waveform
 * hydration, or writing the manifest mid-scroll is what turned a smooth drag into a
 * hitch; deferring it a moment costs nothing. The deadline keeps the durability
 * story: a scroll that never ends cannot postpone a write indefinitely.
 */
export function runAfterInteractionsWithDeadline(work: () => void, deadlineMs = 2000): void {
    let done = false;
    const runOnce = () => {
        if (done) return;
        done = true;
        clearTimeout(deadline);
        work();
    };
    const deadline = setTimeout(runOnce, deadlineMs);
    InteractionManager.runAfterInteractions(runOnce);
}

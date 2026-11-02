import { useEffect, useRef } from "react";

/**
 * What a launch step tells the guard when it finishes: "done" for good, or "again" when
 * it stood down for a reason a later hydration can change (an unsettled disk read), so
 * the next completed hydration may run it once more.
 */
export type LaunchOutcome = "done" | "again";

const runs = new Map<string, Promise<LaunchOutcome>>();

/**
 * Run `step` once per JS process. Not once per mount: on Android an activity rebuild
 * (fold or unfold, font or display size, language, "Don't keep activities") remounts
 * the whole React tree inside the live JS session, and a launch effect keyed on mount
 * reran recovery and cleanup mid-take: it "recovered" the take being recorded and
 * deleted the file the recorder was writing (audit 2026-11-02, 10-H1, 03-3).
 */
export function runOncePerProcess(key: string, step: () => Promise<LaunchOutcome>): Promise<LaunchOutcome> {
  const existing = runs.get(key);
  if (existing) return existing;
  const run = step()
    .catch((error) => {
      console.warn(`[launch] ${key} failed`, error);
      return "done" as LaunchOutcome;
    })
    .then((outcome) => {
      if (outcome === "again" && runs.get(key) === run) runs.delete(key);
      return outcome;
    });
  runs.set(key, run);
  return run;
}

/** The launch sequence, run once per process the first time `ready` is true. */
export function useLaunchSequence(ready: boolean, key: string, step: () => Promise<LaunchOutcome>) {
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!ready) return;
    void runOncePerProcess(key, () => stepRef.current());
  }, [ready, key]);
}

/** Tests only: forget every run, as a fresh process would. */
export function resetLaunchSequenceForTests() {
  runs.clear();
}

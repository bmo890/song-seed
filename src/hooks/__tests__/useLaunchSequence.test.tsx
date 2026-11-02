import React from "react";
import { resetLaunchSequenceForTests, useLaunchSequence, type LaunchOutcome } from "../useLaunchSequence";

// react-test-renderer ships with jest-expo but without type declarations.
type Rendered = { update(element: React.ReactElement): void; unmount(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => Promise<void> | void): Promise<void>;
};
const { act } = TestRenderer;

/**
 * Audit 2026-11-02, 10-H1: an Android activity rebuild remounts the app inside the live
 * JS process. The launch sequence (take recovery, temp sweeps, restore cleanup) must run
 * once per process, never again on that remount.
 */
function Launcher({ ready, step }: { ready: boolean; step: () => Promise<LaunchOutcome> }) {
  useLaunchSequence(ready, "launch", step);
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => resetLaunchSequenceForTests());

describe("launch sequence", () => {
  it("runs once per process, not once per mount", async () => {
    const step = jest.fn(async (): Promise<LaunchOutcome> => "done");

    let app!: Rendered;
    await act(async () => {
      app = TestRenderer.create(<Launcher ready step={step} />);
    });
    await flush();
    await act(async () => app.unmount());

    // The activity is rebuilt: a new App mounts with the store already hydrated.
    await act(async () => {
      app = TestRenderer.create(<Launcher ready step={step} />);
    });
    await flush();

    expect(step).toHaveBeenCalledTimes(1);
    await act(async () => app.unmount());
  });

  it("does not start a second run while the first is still going", async () => {
    let finish!: (outcome: LaunchOutcome) => void;
    const step = jest.fn(() => new Promise<LaunchOutcome>((resolve) => (finish = resolve)));

    let first!: Rendered;
    await act(async () => {
      first = TestRenderer.create(<Launcher ready step={step} />);
    });
    await act(async () => first.unmount());
    let second!: Rendered;
    await act(async () => {
      second = TestRenderer.create(<Launcher ready step={step} />);
    });
    finish("done");
    await flush();

    expect(step).toHaveBeenCalledTimes(1);
    await act(async () => second.unmount());
  });

  it("waits for hydration, and runs again only when a step asked to", async () => {
    const outcomes: LaunchOutcome[] = ["again", "done"];
    const step = jest.fn(async () => outcomes.shift() ?? "done");

    let app!: Rendered;
    await act(async () => {
      app = TestRenderer.create(<Launcher ready={false} step={step} />);
    });
    expect(step).not.toHaveBeenCalled();

    await act(async () => app.update(<Launcher ready step={step} />));
    await flush();
    // The disk read was unsettled; a later hydration completes.
    await act(async () => app.update(<Launcher ready={false} step={step} />));
    await act(async () => app.update(<Launcher ready step={step} />));
    await flush();
    await act(async () => app.update(<Launcher ready={false} step={step} />));
    await act(async () => app.update(<Launcher ready step={step} />));
    await flush();

    expect(step).toHaveBeenCalledTimes(2);
    await act(async () => app.unmount());
  });
});

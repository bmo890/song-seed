jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({}));
// The tape draws with Skia; this test is about the key row above it.
jest.mock("../../../visualizers/LiveTapeVisualizer", () => ({ LiveTapeVisualizer: () => null }));

import React from "react";
import { RecordingMeta, type StereoKeyState } from "../RecordingMeta";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Node = { props: Record<string, any>; findAll(pred: (n: Node) => boolean): Node[] };
type Rendered = { root: Node; unmount(): void };
const { act } = TestRenderer;

function render(stereoKey: StereoKeyState | null) {
  let rendered: Rendered | null = null;
  act(() => {
    rendered = TestRenderer.create(
      <RecordingMeta ideaTitle="" isRecording={false} isPaused={false} elapsedMs={0} hasGuide stereoKey={stereoKey} />
    );
  });
  return rendered!;
}

function stereoKeys(r: Rendered) {
  return r.root.findAll((n) => n.props.testID === "recording-stereo-key" && typeof n.props.onPress === "function");
}

/** The take's Stereo key (2026-11-22): shown where the phone can do stereo, a switch
 *  that reports its state, and still while the take rolls. */
describe("the recorder's Stereo key", () => {
  it("is absent where the phone's mics can't record stereo", () => {
    const r = render(null);
    expect(stereoKeys(r)).toHaveLength(0);
    act(() => r.unmount());
  });

  it("is a switch that flips the take's choice", () => {
    const onToggle = jest.fn();
    const r = render({ on: true, locked: false, pro: false, onToggle });
    const [key] = stereoKeys(r);
    expect(key.props.role).toBe("switch");
    expect(key.props.tone).toBe("active");
    act(() => key.props.onPress());
    expect(onToggle).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it("holds its state but takes no press while the take rolls", () => {
    const r = render({ on: false, locked: true, pro: false, onToggle: () => {} });
    const [key] = stereoKeys(r);
    expect(key.props.tone).toBe("off");
    expect(key.props.disabled).toBe(true);
    act(() => r.unmount());
  });

  it("wears the Pro mark for someone the gate would stop", () => {
    const r = render({ on: false, locked: false, pro: true, onToggle: () => {} });
    expect(stereoKeys(r)[0].props.pro).toBe(true);
    act(() => r.unmount());
  });
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({}));
jest.mock("../../../services/autoSound", () => ({
  isAutoSoundAvailable: () => true,
  suggestAutoSound: jest.fn(async () => ({ gainDb: 9, tonePreset: "low-cut", heard: ["quiet", "rumble"] })),
}));

import React from "react";
import { LevelToneStrip } from "../LevelToneStrip";
import { toggleToneFlag } from "../../../domain/overdub";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void | Promise<void>): Promise<void> | void;
};
type Node = { props: Record<string, any>; findAll(pred: (n: Node) => boolean): Node[] };
type Rendered = { root: Node; update(element: React.ReactElement): void; unmount(): void };
const { act } = TestRenderer;

/** A take's sound held the way the player holds it: every change lands in state. */
function Harness({ onState }: { onState: (sound: { gainDb: number; tonePreset: string }) => void }) {
  const [sound, setSound] = React.useState({ gainDb: 0, tonePreset: "mid-boost" });
  onState(sound);
  return (
    <LevelToneStrip
      gainDb={sound.gainDb}
      tonePreset={sound.tonePreset}
      onCommitGain={(gainDb) => setSound((current) => ({ ...current, gainDb }))}
      onToggleToneFlag={(flag) =>
        setSound((current) => ({ ...current, tonePreset: toggleToneFlag(current.tonePreset, flag) }))
      }
      autoAudioUri="file:///take.wav"
      testID="strip"
    />
  );
}

function autoKey(r: Rendered) {
  return r.root.findAll((n) => n.props.testID === "strip-auto" && typeof n.props.onPress === "function")[0];
}

describe("the Sound strip's Auto", () => {
  it("sets the level and tone it heard, and a second tap puts back what was there", async () => {
    let sound = { gainDb: 0, tonePreset: "" };
    let r: Rendered | null = null;
    await act(async () => {
      r = TestRenderer.create(<Harness onState={(next) => (sound = next)} />);
    });
    await act(async () => {
      await autoKey(r!).props.onPress();
    });
    expect(sound).toEqual({ gainDb: 9, tonePreset: "low-cut" });
    expect(autoKey(r!).props.tone).toBe("active");
    // It says what it heard while its choice stands, and stops once it is undone.
    const heard = () => r!.root.findAll((n) => n.props.testID === "strip-auto-heard" && typeof n.props.children === "string");
    expect(heard()[0]?.props.children).toBe("Too quiet · Low rumble");

    await act(async () => {
      await autoKey(r!).props.onPress();
    });
    expect(sound).toEqual({ gainDb: 0, tonePreset: "mid-boost" });
    expect(autoKey(r!).props.tone).toBe("idle");
    expect(heard()).toHaveLength(0);
    await act(async () => r!.unmount());
  });

  it("keeps Even on its own key: the Tone reset leaves it alone", async () => {
    let sound = { gainDb: 0, tonePreset: "" };
    let r: Rendered | null = null;
    await act(async () => {
      r = TestRenderer.create(<Harness onState={(next) => (sound = next)} />);
    });
    const press = async (id: string) => {
      const key = r!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === "function")[0];
      await act(async () => key.props.onPress());
    };
    await press("strip-even");
    expect(sound.tonePreset).toBe("mid-boost+even");
    const toneReset = r!.root.findAll(
      (n) => n.props.accessibilityLabel === "Reset tone" && typeof n.props.onPress === "function"
    )[0];
    await act(async () => toneReset.props.onPress());
    expect(sound.tonePreset).toBe("even");
    await act(async () => r!.unmount());
  });
});

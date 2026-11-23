jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({}));
// The help sheet is a bottom sheet (safe area, modal): not what these tests are about.
jest.mock("../HelpSheet", () => ({ HelpSheet: () => null }));
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
const saveSound = jest.fn();

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
      onSave={saveSound}
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
    // Before: the key is off and nothing is said beside it (the help holds the words).
    const line = () =>
      r!.root.findAll((n) => n.props.testID === "strip-auto-line" && typeof n.props.children === "string")[0]?.props
        .children;
    expect(autoKey(r!).props.tone).toBe("idle");
    expect(line()).toBe("");
    await act(async () => {
      await autoKey(r!).props.onPress();
    });
    expect(sound).toEqual({ gainDb: 9, tonePreset: "low-cut" });
    // After: the key is lit, and the line says what it heard.
    expect(autoKey(r!).props.tone).toBe("active");
    expect(line()).toBe("Too quiet · Low rumble");

    await act(async () => {
      await autoKey(r!).props.onPress();
    });
    expect(sound).toEqual({ gainDb: 0, tonePreset: "mid-boost" });
    expect(autoKey(r!).props.tone).toBe("idle");
    expect(line()).toBe("");
    await act(async () => r!.unmount());
  });

  it("keeps Even out on its own switch: the Tone reset leaves it alone", async () => {
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

  it("offers Save only while there is a sound to save", async () => {
    let sound = { gainDb: 0, tonePreset: "" };
    let r: Rendered | null = null;
    await act(async () => {
      r = TestRenderer.create(<Harness onState={(next) => (sound = next)} />);
    });
    const saveKey = () =>
      r!.root.findAll((n) => n.props.testID === "strip-save" && typeof n.props.onPress === "function")[0];
    // The harness starts with Mid boost lit: something to save.
    expect(saveKey()).toBeDefined();
    await act(async () => saveKey().props.onPress());
    expect(saveSound).toHaveBeenCalledTimes(1);
    // Flat again: nothing to save, no key.
    const midBoost = r!.root.findAll(
      (n) => n.props.testID === "strip-mid-boost" && typeof n.props.onPress === "function"
    )[0];
    await act(async () => midBoost.props.onPress());
    expect(sound.tonePreset).toBe("neutral");
    expect(saveKey()).toBeUndefined();
    await act(async () => r!.unmount());
  });

  it("the mixer: a band's Boost or Cut lights, the other puts it out, the lit one clears it", async () => {
    let sound = { gainDb: 0, tonePreset: "" };
    let r: Rendered | null = null;
    await act(async () => {
      r = TestRenderer.create(<Harness onState={(next) => (sound = next)} />);
    });
    const key = (id: string) =>
      r!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === "function")[0];
    const press = async (id: string) => act(async () => key(id).props.onPress());
    // The harness starts with Mid boost lit.
    const lit = (id: string) =>
      r!.root.findAll((n) => n.props.testID === id && n.props.accessibilityState !== undefined)[0].props
        .accessibilityState;
    expect(lit("strip-mid-boost")).toEqual({ checked: true });
    expect(lit("strip-mid-cut")).toEqual({ checked: false });
    await press("strip-mid-cut");
    expect(sound.tonePreset).toBe("mid-cut");
    await press("strip-hi-boost");
    expect(sound.tonePreset).toBe("hi-boost+mid-cut");
    // Tapping a lit key clears its band: flat.
    await press("strip-mid-cut");
    expect(sound.tonePreset).toBe("hi-boost");
    expect(key("strip-mid-cut").props.accessibilityLabel).toBe("Mid: Cut");
    await act(async () => r!.unmount());
  });
});

describe("the strip fits the room it is given", () => {
  const { eqDensityForRoom, eqStripHeight } = require("../LevelToneStrip");

  it("is at ease with no room named, or with plenty", () => {
    expect(eqDensityForRoom(null, true)).toBe("roomy");
    expect(eqDensityForRoom(eqStripHeight("roomy", true), true)).toBe("roomy");
  });

  it("puts Level on one line before it tightens anything", () => {
    expect(eqDensityForRoom(eqStripHeight("roomy", true) - 1, true)).toBe("inline");
    expect(eqDensityForRoom(eqStripHeight("inline", true) - 1, true)).toBe("tight");
  });

  it("each step is shorter, and a page too short for the last still gets it", () => {
    expect(eqStripHeight("inline", true)).toBeLessThan(eqStripHeight("roomy", true));
    expect(eqStripHeight("tight", true)).toBeLessThan(eqStripHeight("inline", true));
    expect(eqDensityForRoom(100, true)).toBe("tight");
  });

  it("without the Even out row there is less to fit", () => {
    expect(eqStripHeight("roomy", false)).toBeLessThan(eqStripHeight("roomy", true));
  });
});

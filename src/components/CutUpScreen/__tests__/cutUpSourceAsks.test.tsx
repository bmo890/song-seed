jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({
  selectionAsync: async () => {},
  impactAsync: async () => {},
  notificationAsync: async () => {},
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
// The page pickers are not under test.
jest.mock("../../modals/NotePickerSheet", () => ({ NotePickerSheet: () => null }));
jest.mock("../components/CutUpLineSelectSheet", () => ({ CutUpLineSelectSheet: () => null }));

import React from "react";
import { CutUpSourceStep } from "../components/CutUpSourceStep";
import { dialogStore, type DialogConfig } from "../../common/dialogStore";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Node = { props: Record<string, any>; findAll(pred: (n: Node) => boolean): Node[] };
type Rendered = { root: Node; unmount(): void };
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, 12f F-M2: before the first cut, "From Lyric Pad"
 * replaced typed or pasted source lines without asking.
 */
it("From Lyric Pad asks before replacing typed source lines", () => {
  let dialog: DialogConfig | null = null;
  const unsubscribe = dialogStore.subscribe((config) => (dialog = config));
  const model = {
    sourceField: { draft: "a verse I pasted", onChangeText: jest.fn(), flush: jest.fn() },
    notes: [],
    pickSourceNote: jest.fn(),
  } as any;
  const spark = { chunks: [], cutSeams: undefined } as any;
  let r!: Rendered;
  act(() => {
    r = TestRenderer.create(<CutUpSourceStep model={model} spark={spark} />);
  });
  const fromPad = r.root.findAll((n) => n.props.label === "From Lyric Pad" && typeof n.props.onPress === "function")[0];
  act(() => fromPad.props.onPress());
  expect(dialog?.title).toBe("Replace the source?");
  unsubscribe();
  dialogStore.dismiss();
  act(() => r.unmount());
});

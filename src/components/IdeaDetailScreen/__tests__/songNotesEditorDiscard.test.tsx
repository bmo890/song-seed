jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({}));
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const Pass = ({ children }: { children: React.ReactNode }) => children;
  return { SafeAreaProvider: Pass, SafeAreaView: Pass, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("../../common/AppDialog", () => ({ ModalDialogLayer: () => null }));

import React from "react";
import { SongNotesEditor } from "../components/SongNotesEditor";
import { dialogStore, type DialogConfig } from "../../common/dialogStore";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Node = { props: Record<string, any>; findAll(pred: (n: Node) => boolean): Node[] };
type Rendered = { root: Node; update(element: React.ReactElement): void; unmount(): void };
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, 04-H4: the sketch's Notes editor dropped typed notes
 * on Cancel and on Android back, without asking.
 */
describe("the sketch Notes editor", () => {
  let shown: DialogConfig | null = null;
  let unsubscribe: () => void;
  beforeEach(() => {
    shown = null;
    unsubscribe = dialogStore.subscribe((config) => (shown = config));
  });
  afterEach(() => {
    unsubscribe();
    dialogStore.dismiss();
  });

  function open(onClose: jest.Mock) {
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(
        <SongNotesEditor visible ideaId="song" initialNotes="first line" onSave={() => {}} onClose={onClose} />
      );
    });
    const field = r.root.findAll((n) => typeof n.props.onChangeText === "function" && "value" in n.props)[0];
    act(() => field.props.onChangeText("first line, then the whole second verse"));
    return r;
  }

  it("Cancel with typing asks first", () => {
    const onClose = jest.fn();
    const r = open(onClose);
    const cancel = r.root.findAll((n) => n.props.label === "Cancel" && typeof n.props.onPress === "function")[0];
    act(() => cancel.props.onPress());
    expect(onClose).not.toHaveBeenCalled();
    expect(shown?.title).toBe("Discard changes?");
    // Discard is the person's choice; then it closes.
    act(() => shown!.buttons.find((b) => b.label === "Discard")!.onPress!());
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it("Android back with typing asks first", () => {
    const onClose = jest.fn();
    const r = open(onClose);
    const modal = r.root.findAll((n) => typeof n.props.onRequestClose === "function")[0];
    act(() => modal.props.onRequestClose());
    expect(onClose).not.toHaveBeenCalled();
    expect(shown?.title).toBe("Discard changes?");
    act(() => r.unmount());
  });
});

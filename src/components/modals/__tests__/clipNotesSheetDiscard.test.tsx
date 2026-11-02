jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({}));
// The sheet's chrome (insets, gestures) is not under test: a plain host whose close()
// runs onClose, as the real sheet does once it has slid out.
jest.mock("../../common/BottomSheet", () => {
  const React = require("react");
  return {
    BottomSheet: React.forwardRef(
      ({ children, onClose }: { children: React.ReactNode; onClose: () => void }, ref: React.Ref<unknown>) => {
        React.useImperativeHandle(ref, () => ({ close: onClose }));
        return children;
      }
    ),
  };
});

import React from "react";
import { ClipNotesSheet } from "../ClipNotesSheet";
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
 * Data-safety audit 2026-11-02, root cause 4: Cancel threw typed notes away without
 * asking. With typing in the sheet, Cancel is now a question.
 */
function Harness({ onCancel, notes }: { onCancel: () => void; notes: string }) {
  return (
    <ClipNotesSheet
      visible
      titleDraft="Riff"
      notesDraft={notes}
      onChangeTitle={() => {}}
      onChangeNotes={() => {}}
      onSave={() => {}}
      onCancel={onCancel}
    />
  );
}

function pressCancel(r: Rendered) {
  const cancel = r.root.findAll((n) => n.props.label === "Cancel" && typeof n.props.onPress === "function")[0];
  act(() => cancel.props.onPress());
}

describe("the clip notes sheet's Cancel", () => {
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

  it("asks before throwing typed notes away", () => {
    const onCancel = jest.fn();
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<Harness onCancel={onCancel} notes="old" />);
    });
    act(() => r.update(<Harness onCancel={onCancel} notes="old, then a new verse" />));
    pressCancel(r);
    expect(shown?.title).toBe("Discard changes?");
    expect(shown?.buttons.map((b) => b.label)).toEqual(["Keep editing", "Discard"]);
    r.unmount();
  });

  it("closes without a question when nothing was typed", () => {
    const onCancel = jest.fn();
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<Harness onCancel={onCancel} notes="old" />);
    });
    pressCancel(r);
    expect(shown).toBeNull();
    r.unmount();
  });
});

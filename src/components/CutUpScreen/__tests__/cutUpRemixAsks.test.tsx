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

import React from "react";
import { CutUpDraftEditor } from "../components/CutUpDraftEditor";
import { dialogStore, type DialogConfig } from "../../common/dialogStore";
import { actionMenuStore } from "../../common/actionMenuStore";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Node = { props: Record<string, any>; findAll(pred: (n: Node) => boolean): Node[] };
type Rendered = { root: Node; unmount(): void };
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, 12f F-H4: "edited" lived in a ref that is fresh on
 * every mount, so after Back to Arrange and Draft again, Remix replaced a written
 * draft without asking.
 */
function fakeModel(draft: string) {
  return {
    draftField: { draft, onChangeText: jest.fn(), flush: jest.fn() },
    rebuildDraftFromBoard: jest.fn(),
    composeDraft: jest.fn(),
  } as any;
}

it("Remix asks before replacing a draft found on a fresh mount", () => {
  let menu: any = null;
  const showMenu = jest.spyOn(actionMenuStore, "show").mockImplementation((config: any) => (menu = config));
  let dialog = null as DialogConfig | null;
  const unsubscribe = dialogStore.subscribe((config) => (dialog = config));
  const model = fakeModel("the final draft, written by hand");

  let r!: Rendered;
  act(() => {
    r = TestRenderer.create(<CutUpDraftEditor model={model} spark={{} as any} keyboardVisible={false} />);
  });
  const remixKey = r.root.findAll((n) => n.props.label === "Remix draft" && typeof n.props.onPress === "function")[0];
  act(() => remixKey.props.onPress());
  act(() => menu.actions.find((a: any) => a.key === "mixed").onPress());

  expect(model.composeDraft).not.toHaveBeenCalled();
  expect(dialog).not.toBeNull();

  unsubscribe();
  dialogStore.dismiss();
  showMenu.mockRestore();
  act(() => r.unmount());
});

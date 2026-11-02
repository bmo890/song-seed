import React from "react";

jest.mock("expo-haptics", () => ({}));
jest.mock("../../common/sparkTextScale", () => ({ useSparkTextScale: () => ({ size: 17, lineHeight: 26 }) }));
jest.mock("../../../i18n", () => {
    const { TextInput } = require("react-native");
    return { UserTextInput: TextInput };
});
jest.mock("../../common/InkKey", () => {
    const { Pressable } = require("react-native");
    return {
        inkKeyColor: () => "#000",
        InkKey: ({ onPress, label }: { onPress: () => void; label: string }) => (
            <Pressable onPress={onPress} accessibilityLabel={label} testID="remix" />
        ),
    };
});
const mockMenu = jest.fn();
const mockDestructive = jest.fn();
jest.mock("../../common/AppAlert", () => ({
    AppAlert: { menu: (...args: unknown[]) => mockMenu(...args), destructive: (...args: unknown[]) => mockDestructive(...args) },
}));

import { CutUpDraftEditor } from "../components/CutUpDraftEditor";

type Instance = { findByProps(props: object): { props: Record<string, any> } };
type Rendered = { root: Instance; unmount(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
    create(element: React.ReactElement): Rendered;
    act(run: () => Promise<void> | void): Promise<void>;
};
const { act } = TestRenderer;

/**
 * 12f F-H4: after the draft editor remounts (Back to Arrange and in again, or a
 * reopened spark), Remix replaced a hand-written draft without asking. A draft that
 * was there when the editor opened now counts as edited.
 */
it("Remix asks before replacing a draft that was there when the editor opened", async () => {
    const composeDraft = jest.fn();
    const model = {
        draftField: { draft: "my own words, written by hand", onChangeText: jest.fn(), flush: jest.fn() },
        rebuildDraftFromBoard: jest.fn(),
        composeDraft,
    };
    let app!: Rendered;
    await act(async () => {
        app = TestRenderer.create(
            <CutUpDraftEditor model={model as never} spark={{} as never} keyboardVisible={false} />
        );
    });
    await act(async () => app.root.findByProps({ testID: "remix" }).props.onPress());
    const [, actions] = mockMenu.mock.calls[0] as [string, Array<{ key: string; onPress: () => void }>];
    await act(async () => actions.find((action) => action.key === "mixed")!.onPress());
    expect(composeDraft).not.toHaveBeenCalled();
    expect(mockDestructive).toHaveBeenCalledTimes(1);
    await act(async () => app.unmount());
});

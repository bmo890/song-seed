jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-haptics", () => ({}));

import React from "react";
import { AppState } from "react-native";
import { useEditorDraft } from "../useEditorDraft";
import { useEditorDraftStore } from "../../state/useEditorDraftStore";
import { toastStore } from "../../components/common/toastStore";
import { changedFields, sanitizeEditorDrafts, EDITOR_DRAFT_TTL_MS } from "../../domain/editorDrafts";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Rendered = { update(element: React.ReactElement): void; unmount(): void };
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, 04-H3 / 04-H4 / 12a A-L5: editors held typing in
 * React state only, so a kill or a reload lost it. Unsaved fields now live on disk
 * per item until a save or a discard, and come back when that item's editor opens.
 */
function Editor({
  itemKey,
  text,
  opened,
  onRestore,
  onReady,
}: {
  itemKey: string | null;
  text: string;
  opened: string;
  onRestore: (text: string) => void;
  onReady?: (api: { clear: () => void }) => void;
}) {
  const api = useEditorDraft({
    key: itemKey,
    fields: { text },
    dirty: text !== opened,
    onRestore: (draft) => onRestore(draft.fields.text),
  });
  onReady?.(api);
  return null;
}

const stored = (key: string) => useEditorDraftStore.getState().drafts[key];

describe("unsaved editor words", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useEditorDraftStore.setState({ drafts: {} });
  });
  afterEach(() => jest.useRealTimers());

  it("are kept on a pause in typing, and on leaving the foreground at once", () => {
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<Editor itemKey="lyrics:a" text="v1" opened="v1" onRestore={() => {}} />);
    });
    act(() => r.update(<Editor itemKey="lyrics:a" text="v1 and a verse" opened="v1" onRestore={() => {}} />));
    expect(stored("lyrics:a")).toBeUndefined();
    act(() => jest.advanceTimersByTime(500));
    expect(stored("lyrics:a")?.fields.text).toBe("v1 and a verse");

    act(() => r.update(<Editor itemKey="lyrics:a" text="v1 and a verse, more" opened="v1" onRestore={() => {}} />));
    const listener = (AppState.addEventListener as jest.Mock).mock.calls.at(-1)?.[1];
    act(() => listener?.("background"));
    expect(stored("lyrics:a")?.fields.text).toBe("v1 and a verse, more");
    act(() => r.unmount());
  });

  it("come back the next time that item's editor opens, with a toast", () => {
    useEditorDraftStore.getState().putDraft({ key: "lyrics:a", fields: { text: "lost verse" } });
    const shown = jest.spyOn(toastStore, "show");
    const onRestore = jest.fn();
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<Editor itemKey="lyrics:a" text="v1" opened="v1" onRestore={onRestore} />);
    });
    expect(onRestore).toHaveBeenCalledWith("lost verse");
    expect(shown).toHaveBeenCalledWith(expect.objectContaining({ message: "Unsaved changes restored" }));
    act(() => r.unmount());
    shown.mockRestore();
  });

  it("are not offered to another item", () => {
    useEditorDraftStore.getState().putDraft({ key: "lyrics:a", fields: { text: "a's verse" } });
    const onRestore = jest.fn();
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<Editor itemKey="lyrics:b" text="" opened="" onRestore={onRestore} />);
    });
    expect(onRestore).not.toHaveBeenCalled();
    act(() => r.unmount());
  });

  it("are gone after a save or a discard, even when the editor then unmounts", () => {
    let api!: { clear: () => void };
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(
        <Editor itemKey="lyrics:a" text="typed" opened="" onRestore={() => {}} onReady={(a) => (api = a)} />
      );
    });
    act(() => jest.advanceTimersByTime(500));
    expect(stored("lyrics:a")).toBeDefined();
    act(() => api.clear());
    act(() => r.unmount());
    expect(stored("lyrics:a")).toBeUndefined();
  });

  it("only the changed fields are saved; old drafts are swept", () => {
    expect(changedFields({ title: "Riff", notes: "A" }, { title: "Renamed", notes: "A" })).toEqual({ title: "Renamed" });
    const now = Date.now();
    const swept = sanitizeEditorDrafts(
      {
        fresh: { fields: { text: "x" }, savedAt: now },
        stale: { fields: { text: "y" }, savedAt: now - EDITOR_DRAFT_TTL_MS - 1 },
        broken: { fields: { text: 3 }, savedAt: now },
      },
      now
    );
    expect(Object.keys(swept)).toEqual(["fresh"]);
  });
});

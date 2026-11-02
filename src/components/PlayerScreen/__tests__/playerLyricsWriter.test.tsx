jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
jest.mock("../../../services/waveformAnalysis", () => ({}));
jest.mock("../../../services/audioStorage", () => ({}));
jest.mock("../../../hooks/useKeyboardOverlap", () => ({ useKeyboardOverlap: () => 0 }));

import React from "react";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { PlayerLyricsWriter } from "../components/PlayerLyricsWriter";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../domain/lyrics";
import type { SongIdea } from "../../../types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Node = { props: Record<string, any>; findAll(pred: (n: Node) => boolean): Node[] };
type Rendered = { root: Node; update(element: React.ReactElement): void; unmount(): void };
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, root cause 4 — the player's writer kept its own copy:
 * - 12a A-H3: docked and expanded again, it wrote its older copy over lyrics edited
 *   elsewhere on the next keystroke.
 * - 04-M2: when the queue moved to another sketch, its pending words landed on THAT
 *   sketch's latest version.
 */
const OLD = Date.now() - 100000;

const sketch = (id: string) => ({
  id,
  title: id,
  notes: "",
  status: "seed",
  completionPct: 0,
  kind: "project",
  collectionId: "col",
  createdAt: OLD,
  lastActivityAt: OLD,
  clips: [{ id: `${id}-take`, title: "take", notes: "", createdAt: OLD, isPrimary: true, audioUri: "file:///a.m4a" }],
  lyrics: { versions: [] },
});

function seed() {
  useStore.setState({
    activeWorkspaceId: "here",
    workspaces: [
      {
        id: "here",
        title: "Here",
        collections: [
          {
            id: "col",
            title: "Ideas",
            workspaceId: "here",
            parentCollectionId: null,
            createdAt: OLD,
            updatedAt: OLD,
            ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
          },
        ],
        ideas: [sketch("a"), sketch("b")],
      },
    ],
    activityEvents: [],
  } as never);
}

const idea = (id: string) => useStore.getState().workspaces[0].ideas.find((i) => i.id === id) as SongIdea;
const latestText = (id: string) => lyricsDocumentToText(getLatestLyricsVersion(idea(id))?.document);
const allTexts = (id: string) => (idea(id).lyrics?.versions ?? []).map((v) => lyricsDocumentToText(v.document));

function input(r: Rendered) {
  return r.root.findAll((n) => typeof n.props.onChangeText === "function" && "value" in n.props)[0];
}
function type(r: Rendered, next: (current: string) => string) {
  const field = input(r);
  act(() => field.props.onChangeText(next(field.props.value)));
}

describe("the player's lyric writer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    seed();
  });
  afterEach(() => jest.useRealTimers());

  it("never writes its older copy over words edited elsewhere (A-H3)", () => {
    appActions.saveProjectLyrics("a", "line one\nline two");
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<PlayerLyricsWriter ideaId="a" initialText={latestText("a")} textDirection="auto" />);
    });
    // Docked: the lyric editor fixes a line and adds a chorus.
    jest.advanceTimersByTime(5);
    appActions.saveProjectLyrics("a", "line one\nline TWO fixed\nchorus");
    // Expanded again: the writer re-renders with the stored words, then one key.
    act(() => r.update(<PlayerLyricsWriter ideaId="a" initialText={latestText("a")} textDirection="auto" />));
    type(r, (text) => `${text}!`);
    act(() => jest.advanceTimersByTime(1000));
    act(() => r.unmount());
    expect(allTexts("a").some((text) => text.includes("chorus"))).toBe(true);
    expect(allTexts("a").some((text) => text.includes("TWO fixed"))).toBe(true);
  });

  it("keeps both when the words change elsewhere while it holds unsaved typing", () => {
    appActions.saveProjectLyrics("a", "first");
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<PlayerLyricsWriter ideaId="a" initialText={latestText("a")} textDirection="auto" />);
    });
    type(r, (text) => `${text} draft`);
    jest.advanceTimersByTime(5);
    appActions.saveProjectLyrics("a", "first, edited in the lyric editor");
    act(() => r.unmount());
    expect(allTexts("a")).toEqual(expect.arrayContaining(["first, edited in the lyric editor", "first draft"]));
  });

  it("writes into the sketch it was typing in, not the next one in the queue (04-M2)", () => {
    appActions.saveProjectLyrics("b", "b's own words");
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<PlayerLyricsWriter ideaId="a" initialText="" textDirection="auto" />);
    });
    type(r, () => "a's new verse");
    // Within the autosave pause, the queue moves to sketch b.
    act(() => r.update(<PlayerLyricsWriter ideaId="b" initialText={latestText("b")} textDirection="auto" />));
    act(() => r.unmount());
    expect(latestText("b")).toBe("b's own words");
    expect(latestText("a")).toBe("a's new verse");
  });
});

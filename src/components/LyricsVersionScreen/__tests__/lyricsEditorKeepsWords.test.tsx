jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: async () => {}, impactAsync: async () => {}, notificationAsync: async () => {}, ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock("../../../services/waveformAnalysis", () => ({}));
jest.mock("../../../services/audioStorage", () => ({}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockNavigation = { addListener: () => () => {}, setParams: jest.fn(), dispatch: jest.fn(), goBack: jest.fn() };
let mockRouteParams: Record<string, unknown> = {};
jest.mock("../../../i18n", () => ({
  ...jest.requireActual("../../../i18n"),
  useLocale: () => ({ formatLocale: "en-US" }),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

import React from "react";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { useEditorDraftStore } from "../../../state/useEditorDraftStore";
import { editorDraftKey } from "../../../domain/editorDrafts";
import { getLatestLyricsVersion, lyricsDocumentToText } from "../../../domain/lyrics";
import { useLyricsVersionScreenModel } from "../hooks/useLyricsVersionScreenModel";
import type { SongIdea } from "../../../types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Rendered = { update(element: React.ReactElement): void; unmount(): void };
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, 04-H3: the lyric version editor held its draft in
 * React state only — an eviction or a reload lost the whole writing session — and
 * an in-place Save wrote its copy over words changed elsewhere meanwhile.
 */
const OLD = Date.now() - 100000;

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
        ideas: [
          {
            id: "song",
            title: "Song",
            notes: "",
            status: "seed",
            completionPct: 0,
            kind: "project",
            collectionId: "col",
            createdAt: OLD,
            lastActivityAt: OLD,
            clips: [],
            lyrics: { versions: [] },
          },
        ],
      },
    ],
    activityEvents: [],
  } as never);
  appActions.saveProjectLyrics("song", "verse one");
}

const song = () => useStore.getState().workspaces[0].ideas[0] as SongIdea;
const texts = () => (song().lyrics?.versions ?? []).map((v) => lyricsDocumentToText(v.document));

let model!: ReturnType<typeof useLyricsVersionScreenModel>;
function Probe() {
  model = useLyricsVersionScreenModel();
  return null;
}

describe("the lyric version editor", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useEditorDraftStore.setState({ drafts: {} });
    seed();
    mockRouteParams = { ideaId: "song" };
  });
  afterEach(() => jest.useRealTimers());

  it("keeps a writing session through a kill and gives it back on reopen", () => {
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<Probe />);
    });
    act(() => model.beginEdit());
    act(() => model.handleDraftTextChange("verse one\nfifteen minutes of a second verse"));
    act(() => jest.advanceTimersByTime(1000));
    // The app is evicted: no unmount, no save. A new launch opens the page again.
    const versionId = getLatestLyricsVersion(song())!.id;
    expect(useEditorDraftStore.getState().drafts[editorDraftKey("lyrics", "song", versionId)]).toBeDefined();
    const evicted = r;
    act(() => {
      r = TestRenderer.create(<Probe />);
    });
    expect(model.isEditMode).toBe(true);
    expect(model.draftText).toBe("verse one\nfifteen minutes of a second verse");
    act(() => r.unmount());
    act(() => evicted.unmount());
  });

  it("never saves in place over words changed elsewhere while it was open", () => {
    let r!: Rendered;
    act(() => {
      r = TestRenderer.create(<Probe />);
    });
    act(() => model.beginEdit());
    act(() => model.handleDraftTextChange("verse one, reworked here"));
    // Meanwhile the player's writer adds a chorus to the same latest version.
    jest.advanceTimersByTime(5);
    appActions.saveProjectLyrics("song", "verse one\nchorus from the player");
    act(() => r.update(<Probe />));
    act(() => model.saveDraft());
    expect(texts()).toEqual(expect.arrayContaining(["verse one\nchorus from the player", "verse one, reworked here"]));
    act(() => r.unmount());
  });
});

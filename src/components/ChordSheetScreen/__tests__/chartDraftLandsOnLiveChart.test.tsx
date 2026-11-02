import React from "react";

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
jest.mock("../../../services/manifestSync", () => ({ forceManifestWrite: jest.fn(async () => {}) }));
jest.mock("../../../services/chordChartPdf", () => ({ shareChordSheetPdf: jest.fn() }));
jest.mock("../../common/proUpsell", () => ({ ensurePro: jest.fn(() => true) }));
jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: { ideaId: "sketch" } }),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

import { useStore } from "../../../state/useStore";
import { useChordSheetModel } from "../useChordSheetModel";

// react-test-renderer ships with jest-expo but without type declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): { unmount(): void };
  act(run: () => Promise<void> | void): Promise<void>;
};
const { act } = TestRenderer;

/**
 * Audit 2026-11-02, 12b B-M2 / 12g G-M1: a section-note draft commits half a second
 * after its last keystroke, through that keystroke's render. Built on that render's
 * chart, it reverted a bar added in between.
 */
type Model = ReturnType<typeof useChordSheetModel>;
const renders: Model[] = [];
function Probe() {
  renders.push(useChordSheetModel("sketch"));
  return null;
}

const chart = {
  id: "chart",
  updatedAt: 1,
  sections: [{ id: "verse", kind: "bars", label: "Verse", notes: "", measures: [{ id: "m1", chords: ["C"] }] }],
};

beforeEach(() => {
  renders.length = 0;
  useStore.setState({
    workspaces: [
      {
        id: "ws",
        title: "Mine",
        collections: [{ id: "col", title: "Ideas", workspaceId: "ws", parentCollectionId: null, createdAt: 1, updatedAt: 1, ideasListState: { hiddenIdeaIds: [], hiddenDays: [] } }],
        ideas: [
          {
            id: "sketch",
            title: "Song",
            notes: "",
            status: "seed",
            completionPct: 0,
            kind: "project",
            collectionId: "col",
            clips: [],
            chordSheet: chart,
            createdAt: 1,
            lastActivityAt: 1,
          },
        ],
        isArchived: false,
      },
    ],
    activeWorkspaceId: "ws",
  } as any);
});

const liveChart = () =>
  (useStore.getState().workspaces[0]!.ideas[0] as any).chordSheet as typeof chart;

it("a note draft landing late keeps the bar added after the keystroke", async () => {
  let app!: { unmount(): void };
  await act(async () => {
    app = TestRenderer.create(<Probe />);
  });
  const atKeystroke = renders[renders.length - 1]!; // the render the typing happened in

  // Within the half second: the ghost "+ bar" is tapped (a fresh render's handler).
  await act(async () => {
    renders[renders.length - 1]!.addMeasure("verse");
  });
  expect(liveChart().sections[0]!.measures).toHaveLength(2);

  // The note's draft now commits through the keystroke render's closure.
  await act(async () => {
    atKeystroke.setSectionNotes("verse", "half time");
  });

  const section = liveChart().sections[0]!;
  expect(section.notes).toBe("half time");
  expect(section.measures).toHaveLength(2);
  await act(async () => app.unmount());
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({
  selectionAsync: async () => {},
  impactAsync: async () => {},
  notificationAsync: async () => {},
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
jest.mock("../../../services/waveformAnalysis", () => ({}));
jest.mock("../../../services/audioStorage", () => ({}));

import React from "react";
import { useStore } from "../../../state/useStore";
import { usePlayerPins } from "../hooks/usePlayerPins";
import type { PracticeMarker, SongIdea } from "../../../types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): Rendered;
  act(run: () => void): void;
};
type Rendered = { update(element: React.ReactElement): void; unmount(): void };
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, 12a A-L2: the reel's pin editor held clip A's pin;
 * after the queue moved on, Save ran against clip B's list (A's edit lost, and B's
 * lyric-heading fallback pins saved as real pins).
 */
const OLD = Date.now() - 1000;
const pinA: PracticeMarker = { id: "pin-a", label: "Verse", atMs: 1000 };
const fallbackB: PracticeMarker = { id: "heading-1", label: "Chorus", atMs: 0 };

const clipIdea = (id: string, markers: PracticeMarker[]) => ({
  id,
  title: id,
  notes: "",
  status: "clip",
  completionPct: 0,
  kind: "clip",
  collectionId: "col",
  createdAt: OLD,
  lastActivityAt: OLD,
  clips: [{ id: `${id}-take`, title: id, notes: "", createdAt: OLD, isPrimary: true, audioUri: "file:///a.m4a", practiceMarkers: markers }],
});

function seed() {
  useStore.setState({
    activeWorkspaceId: "here",
    workspaces: [
      {
        id: "here",
        title: "Here",
        collections: [
          { id: "col", title: "Ideas", workspaceId: "here", parentCollectionId: null, createdAt: OLD, updatedAt: OLD, ideasListState: { hiddenIdeaIds: [], hiddenDays: [] } },
        ],
        ideas: [clipIdea("a", [pinA]), clipIdea("b", [])],
      },
    ],
  } as never);
}
const markersOf = (id: string) =>
  (useStore.getState().workspaces[0].ideas.find((i) => i.id === id) as SongIdea).clips[0].practiceMarkers ?? [];

let pins!: ReturnType<typeof usePlayerPins>;
function Probe({ ideaId, markers }: { ideaId: string; markers: PracticeMarker[] }) {
  pins = usePlayerPins({
    playerIdeaId: ideaId,
    playerClipId: `${ideaId}-take`,
    practiceMarkers: markers,
    displayDuration: 10000,
    playerPosition: 0,
  });
  return null;
}

it("a pin edit lands on the take it was opened on, after the queue moves on", () => {
  seed();
  let r!: Rendered;
  act(() => {
    r = TestRenderer.create(<Probe ideaId="a" markers={[pinA]} />);
  });
  act(() => pins.handlePinActions(pinA));
  // The clip ends; clip b plays, drawing its lyric-heading fallback pin.
  act(() => r.update(<Probe ideaId="b" markers={[fallbackB]} />));
  act(() => pins.handleEditPin("pin-a", { label: "Verse 2", note: "" }, pins.pinActionsOwner));
  expect(markersOf("a")[0].label).toBe("Verse 2");
  expect(markersOf("b")).toEqual([]);
  act(() => r.unmount());
});

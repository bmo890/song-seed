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

import React from "react";
import { useStore } from "../../../state/useStore";
import { useCollectionEditModal } from "../hooks/useCollectionEditModal";
import type { SongIdea } from "../../../types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer") as {
  create(element: React.ReactElement): { unmount(): void };
  act(run: () => void): void;
};
const { act } = TestRenderer;

/**
 * Data-safety audit 2026-11-02, 12c C-H1: the collection list's clip Edit sheet
 * pre-filled from the idea's notes, while the player writes the clip's. Edit after
 * a note written in the player showed the older copy, and saving (even a title-only
 * rename) wrote it over the newer one.
 */
const OLD = Date.now() - 1000;

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
            id: "riff",
            title: "Riff",
            notes: "A",
            status: "clip",
            completionPct: 0,
            kind: "clip",
            collectionId: "col",
            createdAt: OLD,
            lastActivityAt: OLD,
            clips: [{ id: "riff-take", title: "Riff", notes: "A", createdAt: OLD, isPrimary: true, audioUri: "file:///a.m4a" }],
          },
        ],
      },
    ],
  } as never);
}

const riff = () => useStore.getState().workspaces[0].ideas.find((idea) => idea.id === "riff") as SongIdea;

/** What the full player's Notes page did before this fix: clip notes only. */
function writeInPlayer(notes: string) {
  useStore.getState().updateIdeas((ideas) =>
    ideas.map((idea) =>
      idea.id !== "riff" ? idea : { ...idea, clips: idea.clips.map((clip) => ({ ...clip, notes })) }
    )
  );
}

let model!: ReturnType<typeof useCollectionEditModal>;
function Probe({ ideas }: { ideas: SongIdea[] }) {
  model = useCollectionEditModal(ideas);
  return null;
}

function mount() {
  let renderer!: { unmount(): void };
  act(() => {
    renderer = TestRenderer.create(<Probe ideas={useStore.getState().workspaces[0].ideas} />);
  });
  return renderer;
}

describe("the collection's clip Edit sheet", () => {
  beforeEach(seed);

  it("opens on the clip's latest notes", () => {
    writeInPlayer("A + the whole second verse");
    const r = mount();
    act(() => {
      model.quickEditIdea(riff());
    });
    expect(model.editClipNotesDraft).toBe("A + the whole second verse");
    r.unmount();
  });

  it("a title-only edit never writes older notes over newer ones", () => {
    const r = mount();
    act(() => {
      model.quickEditIdea(riff());
    });
    // The sheet holds "A"; meanwhile the note grows in the player.
    writeInPlayer("A + the whole second verse");
    act(() => model.setEditClipDraft("Renamed"));
    act(() => model.saveStandaloneClipEdit());
    expect(riff().title).toBe("Renamed");
    expect(riff().clips[0].title).toBe("Renamed");
    expect(riff().clips[0].notes).toBe("A + the whole second verse");
    r.unmount();
  });

  it("a notes edit lands on the clip and the idea alike", () => {
    const r = mount();
    act(() => {
      model.quickEditIdea(riff());
    });
    act(() => model.setEditClipNotesDraft("A, then a bridge"));
    act(() => model.saveStandaloneClipEdit());
    expect(riff().clips[0].notes).toBe("A, then a bridge");
    expect(riff().notes).toBe("A, then a bridge");
    expect(riff().title).toBe("Riff");
    r.unmount();
  });
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
jest.mock("../../services/waveformAnalysis", () => ({}));
jest.mock("../../services/audioStorage", () => ({}));

import { useStore } from "../useStore";
import { useShelfStore } from "../useShelfStore";

/**
 * The Shelf holds pointers only (founder, 2026-10-16: "make sure the shelf
 * doesn't change the created/updated date of a clip"). Setting an idea aside,
 * keeping it longer, letting it leave, re-shelving it and the expiry sweep must
 * leave the library exactly as it was: same objects, same dates, no activity.
 */
const OLD = Date.now() - 90 * 24 * 60 * 60 * 1000;

function seed() {
  useStore.setState({
    activeWorkspaceId: "ws",
    workspaces: [
      {
        id: "ws",
        title: "W",
        collections: [
          {
            id: "col",
            title: "Ideas",
            workspaceId: "ws",
            parentCollectionId: null,
            createdAt: OLD,
            updatedAt: OLD,
            ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
          },
        ],
        ideas: [
          {
            id: "idea-1",
            title: "Porch swing",
            notes: "",
            status: "clip",
            completionPct: 0,
            kind: "clip",
            collectionId: "col",
            createdAt: OLD,
            lastActivityAt: OLD,
            clips: [
              {
                id: "take-1",
                title: "Porch swing",
                notes: "",
                createdAt: OLD,
                isPrimary: true,
                audioUri: "file:///porch.m4a",
                durationMs: 1000,
              },
            ],
          },
        ],
      },
    ],
    activityEvents: [],
  } as never);
}

describe("the Shelf never touches the library", () => {
  beforeEach(seed);

  it("leaves every idea, clip and date untouched through a full shelf life", () => {
    const before = useStore.getState().workspaces;
    const snapshot = JSON.stringify(before);
    const activityBefore = JSON.stringify(
      (useStore.getState() as unknown as Record<string, unknown>).activityEvents ?? null
    );

    const now = 1_800_000_000_000;
    const shelf = useShelfStore.getState();
    shelf.setAside([{ kind: "idea", id: "idea-1" }], now);
    shelf.keepLonger("idea:idea-1", now + 1000);
    shelf.leaveShelf("idea:idea-1", now + 2000);
    shelf.reshelve("idea:idea-1", now + 3000);
    shelf.sweep(now + 365 * 24 * 60 * 60 * 1000);

    expect(useStore.getState().workspaces).toBe(before);
    const idea = useStore.getState().workspaces[0]!.ideas[0]!;
    expect(idea.createdAt).toBe(OLD);
    expect(idea.lastActivityAt).toBe(OLD);
    expect(idea.clips[0]!.createdAt).toBe(OLD);
    expect(JSON.stringify(useStore.getState().workspaces)).toBe(snapshot);
    expect(
      JSON.stringify((useStore.getState() as unknown as Record<string, unknown>).activityEvents ?? null)
    ).toBe(activityBefore);
  });
});

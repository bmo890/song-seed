jest.mock("../audioStorage", () => ({
  __esModule: true,
  getArchiveFileExtension: (uri: string) => uri.split(".").pop(),
  getAudioShareMimeType: () => "audio/mp4",
  sanitizeArchiveSegment: (value: string) => value,
}));
jest.mock("../libraryExport", () => ({ __esModule: true, exportLibrary: jest.fn() }));
jest.mock("../shareLink", () => ({ createShareLink: jest.fn(async () => ({ transferId: "t" })) }));
jest.mock("../clipShareLink", () => {
  const actual = jest.requireActual("../clipShareLink");
  return { ...actual, createClipsShareLink: jest.fn(async () => ({ transferId: "t" })) };
});

import { createShareLink } from "../shareLink";
import { createClipsShareLink } from "../clipShareLink";
import { createCardsShareLink, createTakesShareLink } from "../parcelShare";
import type { ClipVersion, SongIdea } from "../../types";

const clip = (id: string, overrides: Partial<ClipVersion> = {}) =>
  ({ id, title: id, notes: "", createdAt: 1, isPrimary: false, audioUri: `file://${id}.m4a`, ...overrides }) as ClipVersion;
const idea = (id: string, kind: "clip" | "project", clips: ClipVersion[], overrides: Partial<SongIdea> = {}) =>
  ({ id, title: id, notes: "", kind, collectionId: "c", clips, createdAt: 1, ...overrides }) as unknown as SongIdea;

const shareLink = createShareLink as jest.Mock;
const clipsLink = createClipsShareLink as jest.Mock;

beforeEach(() => {
  shareLink.mockClear();
  clipsLink.mockClear();
});

describe("SongNook Send parcels", () => {
  it("plain memos still go as plain audio files, in the chosen order", async () => {
    const entries = [
      { key: "0", idea: idea("a", "clip", [clip("a1")]) },
      { key: "1", idea: idea("b", "clip", [clip("b1")]) },
    ];
    await createCardsShareLink(entries, "Picks", { order: ["1", "0"] });
    expect(shareLink).not.toHaveBeenCalled();
    expect(clipsLink.mock.calls[0][0].map((c: { title: string }) => c.title)).toEqual(["b1", "a1"]);
  });

  it("a clip with marks goes as a clips package with a plain copy beside it", async () => {
    const marked = idea("riff", "clip", [clip("r1", { practiceMarkers: [{ id: "p", label: "x", atMs: 1 }] })]);
    await createCardsShareLink([{ key: "0", idea: marked }], "Riff", {});
    expect(clipsLink).not.toHaveBeenCalled();
    const input = shareLink.mock.calls[0][0];
    expect(input.kind).toBe("clips");
    expect(input.browserCopies.map((f: { fileName: string }) => f.fileName)).toEqual(["r1.m4a"]);
  });

  it("leaving every extra out sends plain audio again", async () => {
    const marked = idea("riff", "clip", [clip("r1", { notes: "n", practiceMarkers: [{ id: "p", label: "x", atMs: 1 }] })]);
    await createCardsShareLink([{ key: "0", idea: marked }], "Riff", { leaveOut: { "0": ["notes", "marks"] } });
    expect(shareLink).not.toHaveBeenCalled();
    expect(clipsLink).toHaveBeenCalledTimes(1);
  });

  it("takes from a sketch with lyrics in arrive as a sketch", async () => {
    const sketch = idea("Blue Hour", "project", [clip("t1"), clip("t2")], {
      lyrics: { versions: [{ id: "v", document: { lines: [] } }] } as any,
    });
    await createTakesShareLink(sketch, [{ key: "0", clip: sketch.clips[1]! }], "Blue Hour takes", {});
    expect(shareLink.mock.calls[0][0].kind).toBe("sketch");
  });

  it("takes from a sketch with its lyrics left out and nothing else go as plain audio", async () => {
    const sketch = idea("Blue Hour", "project", [clip("t1")], {
      lyrics: { versions: [{ id: "v", document: { lines: [] } }] } as any,
    });
    await createTakesShareLink(sketch, [{ key: "0", clip: sketch.clips[0]! }], "Blue Hour takes", {
      sharedLeaveOut: ["lyrics"],
    });
    expect(shareLink).not.toHaveBeenCalled();
    expect(clipsLink).toHaveBeenCalledTimes(1);
  });
});

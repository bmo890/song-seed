import {
  carriesOnlyAudio,
  ideaParts,
  sketchSharedParts,
  takeParts,
  trimClip,
  trimIdea,
} from "../parcelContents";
import type { ClipVersion, SongIdea } from "../../types";

function clip(id: string, overrides: Partial<ClipVersion> = {}): ClipVersion {
  return {
    id,
    title: id,
    notes: "",
    createdAt: 1,
    isPrimary: false,
    audioUri: `file://${id}.m4a`,
    durationMs: 60_000,
    ...overrides,
  } as ClipVersion;
}

function idea(kind: "clip" | "project", clips: ClipVersion[], overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    id: "idea",
    title: "Blue Hour",
    notes: "",
    status: "seed",
    completionPct: 0,
    kind,
    collectionId: "c",
    clips,
    createdAt: 1,
    lastActivityAt: 1,
    ...overrides,
  } as unknown as SongIdea;
}

const marked = clip("m", {
  notes: "watch the bridge",
  practiceMarkers: [{ id: "p", label: "Solo", atMs: 5_000 }],
});
const layered = clip("l", { overdub: { stems: [{ id: "s1", audioUri: "file://s1.m4a" }] } as any });
const lyrics = { versions: [{ id: "v1", document: { lines: [] } }] } as any;

describe("what a parcel item carries", () => {
  it("a plain memo carries only its audio", () => {
    const memo = idea("clip", [clip("a")]);
    expect(ideaParts(memo)).toEqual([]);
    expect(carriesOnlyAudio(memo)).toBe(true);
  });

  it("a take lists its notes, marks and layers, nothing it lacks", () => {
    expect(takeParts(marked)).toEqual(["notes", "marks"]);
    expect(takeParts(layered)).toEqual(["layers"]);
    expect(takeParts(clip("plain", { sections: [{ id: "s" } as any] }))).toEqual(["marks"]);
  });

  it("a sketch lists takes, lyrics, chart, notes and its takes' things, in one order", () => {
    const sketch = idea("project", [marked, layered], { lyrics, chordSheet: { sections: [] } as any, notes: "key of G" });
    expect(ideaParts(sketch)).toEqual(["takes", "lyrics", "chart", "notes", "marks", "layers"]);
    expect(sketchSharedParts(sketch)).toEqual(["lyrics", "chart", "notes"]);
  });

  it("a loose clip never offers lyrics or a chart", () => {
    expect(ideaParts(idea("clip", [marked], { lyrics, chordSheet: {} as any }))).toEqual(["notes", "marks"]);
  });
});

describe("trimming to what the sender kept", () => {
  it("leaves out whole kinds, never part of one", () => {
    const trimmed = trimClip(marked, new Set(["marks"]));
    expect(trimmed.practiceMarkers).toBeUndefined();
    expect(trimmed.sections).toBeUndefined();
    expect(trimmed.notes).toBe("watch the bridge");
  });

  it("layers out sends the bare take", () => {
    expect(trimClip(layered, new Set(["layers"])).overdub).toBeUndefined();
  });

  it("takes out keeps the main take, marked primary", () => {
    const sketch = idea("project", [clip("a"), clip("b", { isPrimary: true }), clip("c")]);
    const trimmed = trimIdea(sketch, new Set(["takes"]));
    expect(trimmed.clips.map((c) => c.id)).toEqual(["b"]);
    expect(trimmed.clips[0]!.isPrimary).toBe(true);
  });

  it("never touches the library's own objects", () => {
    const sketch = idea("project", [marked], { lyrics, notes: "keep" });
    trimIdea(sketch, new Set(["notes", "marks", "lyrics"]));
    expect(sketch.notes).toBe("keep");
    expect(sketch.lyrics).toBe(lyrics);
    expect(marked.practiceMarkers).toHaveLength(1);
  });

  it("a clip with everything left out goes as plain audio", () => {
    const card = idea("clip", [marked]);
    expect(carriesOnlyAudio(card)).toBe(false);
    expect(carriesOnlyAudio(trimIdea(card, new Set(["notes", "marks"])))).toBe(true);
  });
});

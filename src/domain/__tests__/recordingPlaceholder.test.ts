import { isEmptyRecordingPlaceholder, removeEmptyRecordingPlaceholder } from "../recordingPlaceholder";
import type { SongIdea } from "../../types";

const idea = (over: Partial<SongIdea>): SongIdea =>
  ({
    id: "idea-1",
    title: "5:30 PM Sep 8th",
    notes: "",
    status: "clip",
    completionPct: 0,
    kind: "clip",
    collectionId: "col-1",
    clips: [],
    createdAt: 1,
    lastActivityAt: 1,
    ...over,
  }) as SongIdea;

describe("empty recording placeholder (2026-09-08)", () => {
  it("recognises only a clip-kind idea with no clips", () => {
    expect(isEmptyRecordingPlaceholder(idea({}))).toBe(true);
    expect(isEmptyRecordingPlaceholder(idea({ kind: "project" }))).toBe(false);
    expect(isEmptyRecordingPlaceholder(idea({ clips: [{ id: "c" } as never] }))).toBe(false);
    expect(isEmptyRecordingPlaceholder(undefined)).toBe(false);
  });

  it("removes the placeholder the recorder was opened for and nothing else", () => {
    const other = idea({ id: "idea-2", clips: [{ id: "c" } as never] });
    const list = [idea({}), other];
    expect(removeEmptyRecordingPlaceholder(list, "idea-1")).toEqual([other]);
  });

  it("returns the same array when there is nothing to remove", () => {
    const keep = [idea({ kind: "project" }), idea({ id: "idea-2", clips: [{ id: "c" } as never] })];
    expect(removeEmptyRecordingPlaceholder(keep, "idea-1")).toBe(keep);
    expect(removeEmptyRecordingPlaceholder(keep, "idea-2")).toBe(keep);
    expect(removeEmptyRecordingPlaceholder(keep, null)).toBe(keep);
    expect(removeEmptyRecordingPlaceholder(keep, "missing")).toBe(keep);
  });
});

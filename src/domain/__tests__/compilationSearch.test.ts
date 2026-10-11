import { buildIdeaTitleIndex, matchesCompilationSearch } from "../compilationSearch";
import type { Workspace } from "../../types";

const workspaces = [
  { id: "w", ideas: [{ id: "i1", title: "Porch swing melody" }, { id: "i2", title: "Rooftop" }] },
] as unknown as Workspace[];
const titles = buildIdeaTitleIndex(workspaces);

describe("matchesCompilationSearch", () => {
  it("matches everything on an empty query", () => {
    expect(matchesCompilationSearch("   ", { title: "x", ideaIds: [] }, titles)).toBe(true);
  });

  it("matches the compilation's own title and note, case-insensitively", () => {
    expect(matchesCompilationSearch("FRIDAY", { title: "Friday set", ideaIds: [] }, titles)).toBe(true);
    expect(matchesCompilationSearch("quiet", { title: "Set", description: "Start with the quiet one", ideaIds: [] }, titles)).toBe(true);
  });

  it("looks inside: a song's title inside the compilation matches", () => {
    expect(matchesCompilationSearch("porch", { title: "Set 1", ideaIds: ["i1"] }, titles)).toBe(true);
    expect(matchesCompilationSearch("porch", { title: "Set 1", ideaIds: ["i2"] }, titles)).toBe(false);
  });
});

import { getIdeaCreatedAt } from "../domain/ideaSort";
import type { ClipVersion, SongIdea } from "../types";

const TODAY = Date.UTC(2026, 5, 26); // Jun 26 2026
const OCT_2025 = Date.UTC(2025, 9, 1);
const LAST_YEAR = Date.UTC(2025, 0, 1);

function clip(over: Partial<ClipVersion>): ClipVersion {
  return {
    id: over.id ?? "c",
    title: "clip",
    notes: "",
    createdAt: over.createdAt ?? TODAY,
    isPrimary: false,
    ...over,
  } as ClipVersion;
}

function idea(over: Partial<SongIdea>): SongIdea {
  return {
    id: "i",
    title: "Song",
    notes: "",
    status: "seed",
    completionPct: 0,
    kind: "project",
    collectionId: "c0",
    clips: [],
    createdAt: over.createdAt ?? TODAY,
    lastActivityAt: TODAY,
    ...over,
  } as SongIdea;
}

describe("getIdeaCreatedAt", () => {
  it("uses the idea's own date when it has no clips", () => {
    expect(getIdeaCreatedAt(idea({ createdAt: TODAY, clips: [] }))).toBe(TODAY);
  });

  it("anchors a recorded idea to its earliest clip (no importedAt)", () => {
    const recorded = idea({
      createdAt: TODAY,
      clips: [clip({ id: "a", createdAt: LAST_YEAR })],
    });
    expect(getIdeaCreatedAt(recorded)).toBe(LAST_YEAR);
  });

  it("does NOT backdate today's song when an old clip is imported into it", () => {
    const song = idea({
      createdAt: TODAY,
      clips: [
        clip({ id: "rec", createdAt: TODAY }),
        clip({ id: "imp", createdAt: OCT_2025, importedAt: TODAY + 1000 }),
      ],
    });
    expect(getIdeaCreatedAt(song)).toBe(TODAY);
  });

  it("keeps an idea created from an old import anchored to its own old date", () => {
    const fromImport = idea({
      createdAt: OCT_2025,
      clips: [clip({ id: "imp", createdAt: OCT_2025, importedAt: TODAY })],
    });
    expect(getIdeaCreatedAt(fromImport)).toBe(OCT_2025);
  });
});

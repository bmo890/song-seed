import {
  getSearchMatchFilter,
  getSearchMatchFilterLabel,
  SEARCH_MATCH_FILTER_ORDER,
  type GlobalSearchMatchSource,
} from "../search";

describe("getSearchMatchFilter", () => {
  const cases: Array<[GlobalSearchMatchSource, string]> = [
    ["title", "titles"],
    ["clip-title", "titles"],
    ["description", "titles"],
    ["lyrics", "lyrics"],
    ["chords", "chords"],
    ["notes", "notes"],
    ["clip-notes", "notes"],
    ["body", "notes"],
  ];

  it.each(cases)("maps source %s to bucket %s", (source, bucket) => {
    expect(getSearchMatchFilter(source)).toBe(bucket);
  });

  it("labels every ordered bucket", () => {
    for (const filter of SEARCH_MATCH_FILTER_ORDER) {
      expect(getSearchMatchFilterLabel(filter).length).toBeGreaterThan(0);
    }
  });
});

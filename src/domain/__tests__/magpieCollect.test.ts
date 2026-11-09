import {
  magpiePageKey,
  pageMarks,
  pullApartOnPage,
  sanitizeMagpieSpark,
  editFragmentText,
  tokenizePageIntoParagraphs,
  toggleWordOnPage,
} from "../magpie";
import type { MagpieFragment } from "../../types";

const PAGE = "The harbour light was low, and no one answered.";
const { tokens } = tokenizePageIntoParagraphs(PAGE);
const page = magpiePageKey(PAGE);
const book = { id: "b", title: "A Book", author: "Someone", textUrl: "u" };

function tap(fragments: MagpieFragment[], ...words: number[]) {
  return words.reduce((acc, word) => toggleWordOnPage(acc, { tokens, page, word, book }), fragments);
}
const texts = (fragments: MagpieFragment[]) =>
  [...fragments].sort((a, b) => a.order - b.order).map((f) => f.text);

describe("collect on tap", () => {
  it("collects a word at once and keeps it marked on its page", () => {
    const fragments = tap([], 1);
    expect(texts(fragments)).toEqual(["harbour"]);
    expect([...pageMarks(fragments, page).keys()]).toEqual([1]);
    expect(pageMarks(fragments, magpiePageKey("another page")).size).toBe(0);
  });

  it("joins a word beside a collected phrase, with the punctuation between", () => {
    expect(texts(tap([], 1, 2))).toEqual(["harbour light"]);
    expect(texts(tap([], 4, 5))).toEqual(["low, and"]);
  });

  it("bridges two phrases when the word between them is tapped", () => {
    const fragments = tap([], 1, 3, 2);
    expect(texts(fragments)).toEqual(["harbour light was"]);
    expect(fragments).toHaveLength(1);
  });

  it("lets a word go: shrinks at an end, splits in the middle, removes a single", () => {
    expect(texts(tap([], 1, 2, 3, 3))).toEqual(["harbour light"]);
    expect(texts(tap([], 1, 2, 3, 2))).toEqual(["harbour", "was"]);
    expect(tap([], 1, 1)).toEqual([]);
  });

  it("keeps the phrase's place in the order when it grows", () => {
    const fragments = tap([], 8, 1, 7);
    expect(texts(fragments)).toEqual(["one answered", "harbour"]);
    expect(tap(fragments, 99)).toBe(fragments);
  });

  it("pulls a phrase apart at chosen seams; the pieces stay marked separately", () => {
    const joined = tap([], 1, 2, 3);
    const split = pullApartOnPage(joined, { tokens, id: joined[0].id, cutAfter: new Set([1]) });
    expect(texts(split)).toEqual(["harbour", "light was"]);
    expect(split[0].id).toBe(joined[0].id);
    // A tap beside a piece joins that piece, not the other.
    expect(texts(tap(split, 0))).toEqual(["The harbour", "light was"]);
  });

  it("an edit on the build step frees the fragment from the page", () => {
    const fragments = tap([], 1, 2);
    const edited = editFragmentText(fragments, fragments[0].id, "harbour lights");
    expect(pageMarks(edited, page).size).toBe(0);
    expect(texts(tap(edited, 1))).toEqual(["harbour lights", "harbour"]);
  });

  it("survives sanitization with its page anchor", () => {
    const fragments = tap([], 1, 2);
    const spark = sanitizeMagpieSpark({ id: "m", fragments });
    expect(spark?.fragments[0].source).toEqual({ page, words: [1, 2] });
  });
});

import { cleanPassage, toOnePage } from "../magpie";

const words = (n: number, word = "word") => Array.from({ length: n }, () => word).join(" ");
const count = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe("toOnePage", () => {
  it("ends on a sentence between 110 and 170 words", () => {
    const sentence = `${words(19)} end.`;
    const text = Array.from({ length: 30 }, () => sentence).join(" ");
    const page = toOnePage(text, { fromStart: true });
    expect(count(page)).toBeGreaterThanOrEqual(110);
    expect(count(page)).toBeLessThanOrEqual(170);
    expect(page.endsWith("end.")).toBe(true);
  });
  it("opens a mid-book window at its first whole paragraph", () => {
    const text = `ing the rest of a broken line.\n\nThe first real paragraph begins here.\n\n${words(40)}.`;
    expect(toOnePage(text).startsWith("The first real paragraph")).toBe(true);
  });
  it("keeps a short work whole", () => {
    const text = "A short piece.\n\nTwo paragraphs only.";
    expect(toOnePage(text, { fromStart: true })).toBe(text);
  });
  it("cuts prose with no sentence end at the limit, marked", () => {
    const page = toOnePage(words(400), { fromStart: true });
    expect(count(page)).toBe(170);
    expect(page.endsWith("…")).toBe(true);
  });
  it("works for Hebrew sentences", () => {
    const sentence = `${Array.from({ length: 11 }, () => "מילה").join(" ")} סוף.`;
    const page = toOnePage(Array.from({ length: 40 }, () => sentence).join(" "), { fromStart: true });
    expect(count(page)).toBeLessThanOrEqual(170);
    expect(page.endsWith("סוף.")).toBe(true);
  });
});

describe("cleanPassage", () => {
  it("prints Gutenberg's plain-text italics and dashes", () => {
    const raw = "partial line\n--Y además, en nuestro cementerio _municipal_--y subrayó.\npartial";
    expect(cleanPassage(raw)).toBe("—Y además, en nuestro cementerio municipal—y subrayó.");
  });
});

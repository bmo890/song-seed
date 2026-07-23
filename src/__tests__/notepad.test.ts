import { sparkSaveTitle } from "../domain/notepad";
import type { Note } from "../types";

const note = (title: string): Note =>
  ({ id: title, title, body: "", createdAt: 0, updatedAt: 0 } as unknown as Note);

describe("sparkSaveTitle", () => {
  it("keeps the title when nothing collides", () => {
    expect(sparkSaveTitle("River Song", "Cut-Up", [note("Other")])).toBe("River Song");
  });

  it("appends the spark name when the title would shadow an existing page", () => {
    expect(sparkSaveTitle("River Song", "Cut-Up", [note("River Song")])).toBe("River Song · Cut-Up");
  });

  it("compares case-insensitively and numbers further collisions", () => {
    const notes = [note("river song"), note("River Song · Cut-Up")];
    expect(sparkSaveTitle("River Song", "Cut-Up", notes)).toBe("River Song · Cut-Up 2");
  });

  it("leaves an untitled save untitled", () => {
    expect(sparkSaveTitle("  ", "Cut-Up", [note("x")])).toBe("");
  });
});

import { titleFromFileName } from "../fileTitle";

describe("titleFromFileName", () => {
  it("drops the audio extension a received file carries", () => {
    expect(titleFromFileName("To Create (D Song).wav")).toBe("To Create (D Song)");
    expect(titleFromFileName("bass rough.M4A")).toBe("bass rough");
    expect(titleFromFileName("Spring show.songnook")).toBe("Spring show");
  });

  it("keeps a dot that is part of the name", () => {
    expect(titleFromFileName("Mix v2.1")).toBe("Mix v2.1");
    expect(titleFromFileName("Mr. Blue")).toBe("Mr. Blue");
    expect(titleFromFileName(".wav")).toBe(".wav");
  });

  it("removes one extension only, and trims", () => {
    expect(titleFromFileName("  take.wav.wav ")).toBe("take.wav");
  });
});

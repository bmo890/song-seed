import { detectTextDirection, resolveContentDirection } from "../i18n/direction";

describe("authored text direction", () => {
  it("uses the first strong character for mixed-language content", () => {
    expect(detectTextDirection("שלום chorus")).toBe("rtl");
    expect(detectTextDirection("Chorus שלום")).toBe("ltr");
  });

  it("falls back for neutral text and respects document overrides", () => {
    expect(resolveContentDirection("123…", "auto", "rtl")).toBe("rtl");
    expect(resolveContentDirection("שלום", "ltr", "rtl")).toBe("ltr");
  });
});

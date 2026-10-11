import {
  UnsupportedAudioFormatError,
  isAiffExtension,
  isUnsupportedAudioFormatError,
  unsupportedFormatsIn,
} from "../audioImportFormat";

describe("audioImportFormat", () => {
  it("recognises AIFF by extension, any case", () => {
    expect(isAiffExtension("aif")).toBe(true);
    expect(isAiffExtension("AIFF")).toBe(true);
    expect(isAiffExtension("aifc")).toBe(true);
    expect(isAiffExtension("wav")).toBe(false);
    expect(isAiffExtension(undefined)).toBe(false);
  });

  it("tells an unsupported-format refusal from any other import error", () => {
    expect(isUnsupportedAudioFormatError(new UnsupportedAudioFormatError("aiff"))).toBe(true);
    expect(isUnsupportedAudioFormatError(new Error("disk full"))).toBe(false);
    expect(isUnsupportedAudioFormatError(null)).toBe(false);
  });

  it("names each refused format once across a batch", () => {
    const failures = [
      { error: new UnsupportedAudioFormatError("aiff") },
      { error: new Error("copy failed") },
      { error: new UnsupportedAudioFormatError("aiff") },
    ];
    expect(unsupportedFormatsIn(failures)).toEqual(["aiff"]);
    expect(unsupportedFormatsIn([{ error: new Error("x") }])).toEqual([]);
  });
});

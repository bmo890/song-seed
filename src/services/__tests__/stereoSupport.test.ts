jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@siteed/audio-studio", () => ({
  ExpoAudioStreamModule: { songNookStereoSupport: () => "yes" },
}));

import { getStereoSupport, noteStereoTake, refreshStereoSupport, resetStereoVerdictForTests } from "../stereoSupport";

describe("what a phone's own takes say about its stereo", () => {
  beforeEach(() => {
    resetStereoVerdictForTests();
    refreshStereoSupport();
  });

  it("one copied take only raises a doubt: a covered mic reads the same", () => {
    expect(noteStereoTake("one-sided", "android")).toBe(false);
    expect(getStereoSupport()).toBe("yes");
  });

  it("a second one in a row settles it, and says so once", () => {
    expect(noteStereoTake("copied", "android")).toBe(false);
    expect(noteStereoTake("copied", "android")).toBe(true);
    expect(getStereoSupport()).toBe("no");
    expect(noteStereoTake("copied", "android")).toBe(false);
  });

  it("a real stereo take clears the doubt for good", () => {
    noteStereoTake("copied", "android");
    noteStereoTake("stereo", "android");
    expect(noteStereoTake("copied", "android")).toBe(false);
    expect(noteStereoTake("one-sided", "android")).toBe(false);
    expect(getStereoSupport()).toBe("yes");
  });

  it("a take too short or too quiet to judge counts for nothing", () => {
    noteStereoTake("copied", "android");
    expect(noteStereoTake("unsure", "android")).toBe(false);
    expect(getStereoSupport()).toBe("yes");
  });

  it("never judges an iPhone: a copied take there is a route that fell back", () => {
    expect(noteStereoTake("copied", "ios")).toBe(false);
    expect(noteStereoTake("copied", "ios")).toBe(false);
    expect(getStereoSupport()).toBe("yes");
  });
});

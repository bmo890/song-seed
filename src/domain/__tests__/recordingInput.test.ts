import { effectiveRecordingInputId } from "../recordingInput";

const phone = { id: "15", type: "builtin_mic" };
const headset = { id: "22", type: "wired_headset" };
const bt = { id: "31", type: "bluetooth" };

describe("the input a take records from", () => {
  it("is the writer's own choice when there is one", () => {
    expect(effectiveRecordingInputId("22", [phone, headset], "android")).toBe("22");
  });

  it("is the phone's mic on Android when a wired headset is plugged in", () => {
    expect(effectiveRecordingInputId(null, [headset, phone], "android")).toBe("15");
  });

  it("is left to the system otherwise", () => {
    expect(effectiveRecordingInputId(null, [phone], "android")).toBeNull();
    expect(effectiveRecordingInputId(null, [phone, bt], "android")).toBeNull();
    expect(effectiveRecordingInputId(null, [phone, headset], "ios")).toBeNull();
  });
});

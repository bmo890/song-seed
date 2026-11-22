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

describe("a stereo take's input on Android", () => {
  const phone = { id: "1", type: "builtin_mic" };
  const usb = { id: "9", type: "usb_device" };
  it("leaves the built-in pair to the phone's routing, chosen or not", () => {
    expect(effectiveRecordingInputId(null, [phone], "android", { stereo: true })).toBeNull();
    expect(effectiveRecordingInputId("1", [phone], "android", { stereo: true })).toBeNull();
  });
  it("keeps a chosen USB input (the take is mono there)", () => {
    expect(effectiveRecordingInputId("9", [phone, usb], "android", { stereo: true })).toBe("9");
  });
  it("keeps the headset rule (the take is mono with a headset in)", () => {
    expect(
      effectiveRecordingInputId(null, [phone, { id: "3", type: "wired_headset" }], "android", { stereo: true })
    ).toBe("1");
  });
  it("changes nothing on iPhone", () => {
    expect(effectiveRecordingInputId("1", [phone], "ios", { stereo: true })).toBe("1");
  });
});

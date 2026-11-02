jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({
  selectionAsync: async () => {},
  impactAsync: async () => {},
  notificationAsync: async () => {},
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
}));
jest.mock("../../../services/waveformAnalysis", () => ({}));
jest.mock("../../../services/audioStorage", () => ({}));

import { useStore } from "../../../state/useStore";
import { sendSparkToPad } from "../sparkSend";
import { dialogStore, type DialogConfig } from "../dialogStore";

/**
 * Data-safety audit 2026-11-02, 12g G-H1 / 12f F-M1: a spark sent to the Lyric Pad
 * a second time offered "Update page", which replaced the page's words — including
 * everything written on that page in the Pad since the first send.
 */
const navigation = { navigate: jest.fn() };

function padPage(body: string) {
  const { addNote, updateNote } = useStore.getState();
  const id = addNote();
  updateNote(id, { title: "Ladder", body });
  return id;
}
const bodyOf = (id: string) => useStore.getState().notes.find((note) => note.id === id)!.body;

describe("sending a spark to the Lyric Pad again", () => {
  let shown: DialogConfig | null = null;
  let unsubscribe: () => void;
  beforeEach(() => {
    useStore.setState({ notes: [] } as never);
    shown = null;
    unsubscribe = dialogStore.subscribe((config) => (shown = config));
  });
  afterEach(() => {
    unsubscribe();
    dialogStore.dismiss();
  });

  it("names the replace, as a destructive choice, when the page was written on since", () => {
    const id = padPage("ladder words\nand a verse written in the Pad");
    const link = jest.fn();
    sendSparkToPad({
      text: "ladder words, revised",
      title: "Ladder",
      methodName: "Word Ladder",
      savedLyricId: id,
      savedLyricBody: "ladder words",
      link,
      navigation,
    });
    const replace = shown!.buttons.find((b) => b.label === "Replace page");
    expect(replace?.style).toBe("destructive");
    expect(shown!.buttons.some((b) => b.label === "Update page")).toBe(false);
    // Choosing it is the person's call; the page then carries the spark's words.
    replace!.onPress!();
    expect(bodyOf(id)).toBe("ladder words, revised");
    expect(link).toHaveBeenCalledWith(id, "ladder words, revised");
  });

  it("keeps the plain Update when the page still holds what was sent", () => {
    const id = padPage("ladder words");
    sendSparkToPad({
      text: "ladder words, revised",
      title: "Ladder",
      methodName: "Word Ladder",
      savedLyricId: id,
      savedLyricBody: "ladder words",
      link: () => {},
      navigation,
    });
    expect(shown!.buttons.find((b) => b.label === "Update page")?.style).toBe("default");
  });
});

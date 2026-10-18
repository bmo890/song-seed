jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  readingChordShift,
  sanitizeCapos,
  useChartPrefsStore,
} from "../useChartPrefsStore";
import { transposeChordSymbol } from "../../domain/transpose";
import { mergeSatelliteState } from "../../services/satelliteSnapshot";

beforeEach(() => {
  useChartPrefsStore.setState({ transposeByIdeaId: {}, capoByIdeaId: {}, readingZoom: 1, chordsHidden: false });
});

test("a capo shows the shapes you finger: G sounds from an F shape with capo 2", () => {
  const shift = readingChordShift(0, 2);
  expect(shift).toBe(-2);
  expect(transposeChordSymbol("G", shift)).toBe("F");
});

test("key and capo combine: up 2 with capo 2 reads as written", () => {
  expect(readingChordShift(2, 2)).toBe(0);
});

test("capo is optional and per song; it steps between none and fret 11", () => {
  const prefs = useChartPrefsStore.getState();
  prefs.nudgeCapo("song", -1);
  expect(useChartPrefsStore.getState().capoByIdeaId).toEqual({});
  for (let i = 0; i < 14; i += 1) useChartPrefsStore.getState().nudgeCapo("song", 1);
  expect(useChartPrefsStore.getState().capoByIdeaId).toEqual({ song: 11 });
  useChartPrefsStore.getState().resetCapo("song");
  expect(useChartPrefsStore.getState().capoByIdeaId).toEqual({});
});

test("a bad saved capo is dropped, not trusted", () => {
  expect(sanitizeCapos({ a: 3, b: -1, c: 12, d: 1.5, e: 0 })).toEqual({ a: 3 });
});

test("restoring a backup keeps this phone's capo and brings back backup-only ones", () => {
  const merged = mergeSatelliteState(
    "chartPrefs",
    { transposeByIdeaId: {}, capoByIdeaId: { shared: 5, old: 3 } },
    { transposeByIdeaId: {}, capoByIdeaId: { shared: 2 } }
  );
  expect(merged.capoByIdeaId).toEqual({ shared: 2, old: 3 });
});

jest.mock("../../state/useStore", () => ({
    useStore: { getState: () => ({ playerIsPlaying: false, inlineIsPlaying: false }) },
}));

import {
    isForegroundAudioBusy,
    isRecordingActive,
    onRecordingActivityChange,
    setRecorderCapturing,
    setRecorderScreenOpen,
} from "../audioForegroundActivity";

/**
 * "Recording is active" switches off every background waveform decode, so it must be
 * impossible to leave it on. It is driven by the recorder screen's mount and the shared
 * recorder's state — never by store ids, which can outlive the recorder (2026-09-21).
 */
describe("recording activity", () => {
    afterEach(() => {
        setRecorderCapturing(false);
        while (isRecordingActive()) setRecorderScreenOpen(false);
    });

    it("is busy while the recorder screen is open and idle once it closes", () => {
        expect(isForegroundAudioBusy()).toBe(false);
        setRecorderScreenOpen(true);
        expect(isForegroundAudioBusy()).toBe(true);
        setRecorderScreenOpen(false);
        expect(isForegroundAudioBusy()).toBe(false);
    });

    it("stays busy for a minimized take after the screen closes", () => {
        setRecorderScreenOpen(true);
        setRecorderCapturing(true);
        setRecorderScreenOpen(false);
        expect(isRecordingActive()).toBe(true);
        setRecorderCapturing(false);
        expect(isRecordingActive()).toBe(false);
    });

    it("never goes negative on an unbalanced close", () => {
        setRecorderScreenOpen(false);
        setRecorderScreenOpen(true);
        expect(isRecordingActive()).toBe(true);
    });

    it("notifies only on real transitions", () => {
        const listener = jest.fn();
        const stop = onRecordingActivityChange(listener);
        setRecorderScreenOpen(true);
        setRecorderCapturing(true); // already active: no second notification
        setRecorderScreenOpen(false); // still capturing: still active
        setRecorderCapturing(false);
        stop();
        expect(listener.mock.calls).toEqual([[true], [false]]);
    });
});

import { setAudioModeAsync } from "expo-audio";

const sharedPlaybackAudioMode = {
    allowsRecording: false,
    interruptionMode: "doNotMix" as const,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
};

const sharedRecordingAudioMode = {
    allowsRecording: true,
    allowsBackgroundRecording: true,
    interruptionMode: "mixWithOthers" as const,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
};

export async function activatePlaybackAudioSession() {
    await setAudioModeAsync(sharedPlaybackAudioMode);
}

export async function activateRecordingAudioSession() {
    await setAudioModeAsync(sharedRecordingAudioMode);
}

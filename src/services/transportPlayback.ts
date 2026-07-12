import { activatePlaybackAudioSession } from "./audioSession";
import { cancelActiveWaveformDecode } from "./waveformAnalysis";

type TransportPlaybackStatus = {
    duration?: number;
    currentTime?: number;
};

type MaybePromise<T> = T | Promise<T>;

type TransportAudioPlayer = {
    pause: () => MaybePromise<void>;
    play: () => MaybePromise<void>;
    seekTo: (seconds: number) => MaybePromise<void>;
    replace: (source: { uri: string }) => MaybePromise<void>;
};

type ActivateAndPlayOptions = {
    onRestartFromEnd?: () => MaybePromise<void>;
};

type ReplacePlaybackSourceOptions = {
    seekToStart?: boolean;
};

export function readPlaybackTimingMs(
    status: TransportPlaybackStatus,
    durationOverrideMs = 0,
    positionOverrideMs = 0
) {
    const durationMs = durationOverrideMs || Math.round((status.duration ?? 0) * 1000);
    const positionMs = positionOverrideMs || Math.round((status.currentTime ?? 0) * 1000);
    return { durationMs, positionMs };
}

export function isPlaybackNearEnd(positionMs: number, durationMs: number, thresholdMs = 250) {
    return durationMs > 0 && positionMs >= durationMs - thresholdMs;
}

export async function activateAndPlay(
    player: Pick<TransportAudioPlayer, "play" | "seekTo">,
    status: TransportPlaybackStatus,
    durationOverrideMs = 0,
    positionOverrideMs = 0,
    options: ActivateAndPlayOptions = {}
) {
    const { durationMs, positionMs } = readPlaybackTimingMs(status, durationOverrideMs, positionOverrideMs);
    const shouldRestartFromEnd = isPlaybackNearEnd(positionMs, durationMs);

    // Playback is starting: synchronously preempt any background waveform decode
    // BEFORE the engine round-trips — an in-flight decode on the shared codec pool
    // is what made fresh clips "play a second then pause". Centralized here so every
    // play entry point (full player, inline players, region previews) is covered.
    cancelActiveWaveformDecode();
    await activatePlaybackAudioSession();
    if (shouldRestartFromEnd) {
        await player.seekTo(0);
        await options.onRestartFromEnd?.();
    }
    await player.play();

    return { restartedFromEnd: shouldRestartFromEnd };
}

export async function replacePlaybackSource(
    player: TransportAudioPlayer,
    audioUri: string,
    autoPlay = false,
    options: ReplacePlaybackSourceOptions = {}
) {
    const seekToStart = options.seekToStart ?? true;

    // Same preemption as activateAndPlay: a source swap is an acute engine-load
    // window and must not share the codec with a background decode.
    cancelActiveWaveformDecode();
    await activatePlaybackAudioSession();
    await player.replace({ uri: audioUri });
    if (seekToStart) {
        await player.seekTo(0);
    }
    if (autoPlay) {
        await player.play();
        return;
    }
    await player.pause();
}

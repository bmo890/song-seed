import { activatePlaybackAudioSession } from "./audioSession";

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
    positionOverrideMs = 0
) {
    const { durationMs, positionMs } = readPlaybackTimingMs(status, durationOverrideMs, positionOverrideMs);

    await activatePlaybackAudioSession();
    if (isPlaybackNearEnd(positionMs, durationMs)) {
        await player.seekTo(0);
    }
    await player.play();
}

export async function replacePlaybackSource(
    player: TransportAudioPlayer,
    audioUri: string,
    autoPlay = false
) {
    await activatePlaybackAudioSession();
    await player.replace({ uri: audioUri });
    if (autoPlay) {
        await player.play();
        return;
    }
    await player.pause();
}

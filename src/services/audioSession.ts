import { Platform } from "react-native";
import { setAudioModeAsync, setIsAudioActiveAsync } from "expo-audio";

export type AudioSessionRole = "playback" | "engine" | "recording" | "metronome";

type AudioSessionActivationOptions = {
    ownerId?: string;
    force?: boolean;
    /** Make this owner's role win outright while it is held, ignoring the priority
     *  ladder. The one sanctioned use is Bluetooth calibration: it must drop
     *  `allowsRecording` so iOS releases the headset mic and the route leaves the
     *  phone-call (HFP) profile — but the recording screen underneath holds a
     *  higher-priority "recording" owner the ladder would otherwise obey. */
    exclusive?: boolean;
};

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

const sharedMetronomeAudioMode = {
    allowsRecording: true,
    interruptionMode: "mixWithOthers" as const,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
};

/**
 * The pitch engine owns playback with the full player running muted beside it
 * (2026-10-21). On Android only one player may hold audio focus: the engine's
 * ExoPlayer takes it, and expo-audio asks for it again on every play, so each
 * start paused the other (a multi-second wait on every pitch change and scrub).
 * While the engine plays, expo-audio is told to mix, which on Android means it
 * never asks for focus; the engine alone holds it. iOS has no such rule inside
 * an app and keeps the playback mode (see activateEngineAudioSession).
 */
const sharedEngineAudioMode = {
    ...sharedPlaybackAudioMode,
    interruptionMode: "mixWithOthers" as const,
};

const audioSessionModes = {
    playback: sharedPlaybackAudioMode,
    engine: sharedEngineAudioMode,
    recording: sharedRecordingAudioMode,
    metronome: sharedMetronomeAudioMode,
} satisfies Record<
    AudioSessionRole,
    | typeof sharedPlaybackAudioMode
    | typeof sharedEngineAudioMode
    | typeof sharedRecordingAudioMode
    | typeof sharedMetronomeAudioMode
>;

const audioSessionPriority: Record<AudioSessionRole, number> = {
    playback: 0,
    engine: 0.5,
    metronome: 1,
    recording: 2,
};

const IDLE_AUDIO_SESSION_ROLE: AudioSessionRole = "playback";

const activeAudioSessionOwners = new Map<string, AudioSessionRole>();

let nextAudioSessionOwnerId = 1;
let appliedAudioSessionRole: AudioSessionRole | null = null;
let exclusiveAudioSessionOwnerId: string | null = null;
let audioSessionQueue = Promise.resolve();

function resolveEffectiveAudioSessionRole(fallbackRole = IDLE_AUDIO_SESSION_ROLE) {
    if (exclusiveAudioSessionOwnerId) {
        const exclusiveRole = activeAudioSessionOwners.get(exclusiveAudioSessionOwnerId);
        if (exclusiveRole) {
            return exclusiveRole;
        }
        exclusiveAudioSessionOwnerId = null;
    }

    let resolvedRole = fallbackRole;

    for (const requestedRole of activeAudioSessionOwners.values()) {
        if (audioSessionPriority[requestedRole] > audioSessionPriority[resolvedRole]) {
            resolvedRole = requestedRole;
        }
    }

    return resolvedRole;
}

async function applyAudioSessionRole(role: AudioSessionRole, force = false) {
    if (!force && appliedAudioSessionRole === role) {
        return;
    }

    await setAudioModeAsync(audioSessionModes[role]);
    appliedAudioSessionRole = role;
}

function enqueueAudioSessionUpdate<T>(operation: () => Promise<T>) {
    const run = audioSessionQueue.then(operation, operation);
    audioSessionQueue = run.then(
        () => undefined,
        () => undefined
    );
    return run;
}

function activateAudioSessionRole(
    role: AudioSessionRole,
    options: AudioSessionActivationOptions = {}
) {
    return enqueueAudioSessionUpdate(async () => {
        const previousRole = options.ownerId ? activeAudioSessionOwners.get(options.ownerId) : undefined;
        const previousExclusiveOwnerId = exclusiveAudioSessionOwnerId;

        if (options.ownerId) {
            activeAudioSessionOwners.set(options.ownerId, role);
            if (options.exclusive) {
                exclusiveAudioSessionOwnerId = options.ownerId;
            }
        }

        try {
            await applyAudioSessionRole(resolveEffectiveAudioSessionRole(role), options.force);
        } catch (error) {
            exclusiveAudioSessionOwnerId = previousExclusiveOwnerId;
            if (options.ownerId) {
                if (previousRole) {
                    activeAudioSessionOwners.set(options.ownerId, previousRole);
                } else {
                    activeAudioSessionOwners.delete(options.ownerId);
                }
            }
            throw error;
        }
    });
}

export function createAudioSessionOwner(scope: string) {
    const normalizedScope = scope.trim().length > 0 ? scope.trim() : "audio";
    const ownerId = `${normalizedScope}:${nextAudioSessionOwnerId}`;
    nextAudioSessionOwnerId += 1;
    return ownerId;
}

export async function releaseAudioSessionOwner(ownerId: string, force = false) {
    await enqueueAudioSessionUpdate(async () => {
        const removed = activeAudioSessionOwners.delete(ownerId);
        if (exclusiveAudioSessionOwnerId === ownerId) {
            exclusiveAudioSessionOwnerId = null;
        }
        const nextRole = resolveEffectiveAudioSessionRole();

        if (!removed && !force && appliedAudioSessionRole === nextRole) {
            return;
        }

        await applyAudioSessionRole(nextRole, force);
    });
}

export async function activatePlaybackAudioSession(
    options: AudioSessionActivationOptions = {}
) {
    await activateAudioSessionRole("playback", options);
}

/** The pitch engine's session; the playback session outside Android. */
export async function activateEngineAudioSession(options: AudioSessionActivationOptions = {}) {
    await activateAudioSessionRole(Platform.OS === "android" ? "engine" : "playback", options);
}

/**
 * Android: expo-audio gives up the audio focus it holds (and pauses its
 * players for the moment), so the engine that starts next takes focus without
 * knocking the muted full player off. No-op elsewhere.
 */
export async function handBackPlayerAudioFocus() {
    if (Platform.OS !== "android") return;
    await setIsAudioActiveAsync(false);
    await setIsAudioActiveAsync(true);
}

export async function activateRecordingAudioSession(
    options: AudioSessionActivationOptions = {}
) {
    await activateAudioSessionRole("recording", options);
}

export async function activateMetronomeAudioSession(
    options: AudioSessionActivationOptions = {}
) {
    await activateAudioSessionRole("metronome", options);
}

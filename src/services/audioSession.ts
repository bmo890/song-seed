import { setAudioModeAsync } from "expo-audio";

export type AudioSessionRole = "playback" | "recording" | "metronome";

type AudioSessionActivationOptions = {
    ownerId?: string;
    force?: boolean;
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

const audioSessionModes = {
    playback: sharedPlaybackAudioMode,
    recording: sharedRecordingAudioMode,
    metronome: sharedMetronomeAudioMode,
} satisfies Record<
    AudioSessionRole,
    typeof sharedPlaybackAudioMode | typeof sharedRecordingAudioMode | typeof sharedMetronomeAudioMode
>;

const audioSessionPriority: Record<AudioSessionRole, number> = {
    playback: 0,
    metronome: 1,
    recording: 2,
};

const IDLE_AUDIO_SESSION_ROLE: AudioSessionRole = "playback";

const activeAudioSessionOwners = new Map<string, AudioSessionRole>();

let nextAudioSessionOwnerId = 1;
let appliedAudioSessionRole: AudioSessionRole | null = null;
let audioSessionQueue = Promise.resolve();

function resolveEffectiveAudioSessionRole(fallbackRole = IDLE_AUDIO_SESSION_ROLE) {
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

        if (options.ownerId) {
            activeAudioSessionOwners.set(options.ownerId, role);
        }

        try {
            await applyAudioSessionRole(resolveEffectiveAudioSessionRole(role), options.force);
        } catch (error) {
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

export function getAudioSessionDebugState() {
    return {
        appliedRole: appliedAudioSessionRole,
        owners: Array.from(activeAudioSessionOwners.entries()).map(([ownerId, role]) => ({
            ownerId,
            role,
        })),
    };
}

export async function releaseAudioSessionOwner(ownerId: string, force = false) {
    await enqueueAudioSessionUpdate(async () => {
        const removed = activeAudioSessionOwners.delete(ownerId);
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

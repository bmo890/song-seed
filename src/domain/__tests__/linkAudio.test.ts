import { clipAudioUris, isLosslessAudioUri, losslessAudioToEncode, substituteEncodedAudio } from "../linkAudio";
import type { ClipVersion, Workspace } from "../../types";

const clip = (over: Partial<ClipVersion>): ClipVersion =>
    ({ id: "c", title: "c", notes: "", createdAt: 0, isPrimary: true, ...over }) as ClipVersion;

describe("isLosslessAudioUri", () => {
    it("knows PCM containers from compressed ones", () => {
        expect(isLosslessAudioUri("file:///a/take.WAV")).toBe(true);
        expect(isLosslessAudioUri("file:///a/take.aiff")).toBe(true);
        expect(isLosslessAudioUri("file:///a/take.m4a")).toBe(false);
        expect(isLosslessAudioUri("file:///a/take.mp3")).toBe(false);
        expect(isLosslessAudioUri(undefined)).toBe(false);
    });
});

describe("losslessAudioToEncode", () => {
    it("keeps only lossless files, once each, in order", () => {
        expect(losslessAudioToEncode(["a.wav", "b.m4a", "a.wav", undefined, "c.aif"])).toEqual(["a.wav", "c.aif"]);
    });
});

describe("substituteEncodedAudio", () => {
    const stems = [{ id: "s1", title: "s", audioUri: "s1.wav" } as ClipVersion["overdub"] extends infer O ? (O extends { stems: (infer S)[] } ? S : never) : never];
    const original = clip({
        audioUri: "take.wav",
        sourceAudioUri: "source.wav",
        overdub: { stems, renderedMixUri: "mix.wav" },
    });
    const workspace = { id: "w", title: "w", ideas: [{ id: "i", title: "i", clips: [original, clip({ id: "c2", audioUri: "ok.m4a" })] }] } as unknown as Workspace;

    it("points every audio field at its encoded copy and leaves the rest alone", () => {
        const encoded = new Map([
            ["take.wav", "take.m4a"],
            ["source.wave", "never"],
            ["s1.wav", "s1.m4a"],
            ["mix.wav", "mix.m4a"],
        ]);
        const [out] = substituteEncodedAudio([workspace], encoded);
        const [first, second] = out.ideas[0].clips;
        expect(first.audioUri).toBe("take.m4a");
        expect(first.sourceAudioUri).toBe("source.wav");
        expect(first.overdub?.renderedMixUri).toBe("mix.m4a");
        expect(first.overdub?.stems[0].audioUri).toBe("s1.m4a");
        expect(second).toBe(workspace.ideas[0].clips[1]);
        expect(clipAudioUris(first)).toEqual(["take.m4a", "source.wav", "mix.m4a", "s1.m4a"]);
    });

    it("returns the same references when nothing was encoded", () => {
        expect(substituteEncodedAudio([workspace], new Map())).toEqual([workspace]);
        expect(substituteEncodedAudio([workspace], new Map([["x.wav", "x.m4a"]]))[0]).toBe(workspace);
    });
});

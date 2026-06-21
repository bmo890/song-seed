jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
}));

import { rebaseWorkspacesManagedMedia, toRelativeWorkspacesManagedMedia } from "../rebaseManagedMedia";
import type { Workspace } from "../../types";

const OLD = "file:///old/Documents/songseed/audio";
const NEW = "file:///doc/songseed/audio";

function libraryWith(audioBase: string): Workspace[] {
    return [
        {
            id: "ws-1",
            title: "ws",
            collections: [],
            ideas: [
                {
                    id: "idea-1",
                    title: "i",
                    notes: "",
                    status: "seedling" as never,
                    completionPct: 0,
                    kind: "project",
                    collectionId: "c",
                    createdAt: 0,
                    lastActivityAt: 0,
                    clips: [
                        {
                            id: "clip-1",
                            title: "c1",
                            notes: "",
                            createdAt: 0,
                            isPrimary: true,
                            audioUri: `${audioBase}/clip-1.m4a`,
                            sourceAudioUri: `${audioBase}/clip-1-src.m4a`,
                            overdub: {
                                stems: [
                                    {
                                        id: "stem-1",
                                        title: "s1",
                                        gainDb: 0,
                                        offsetMs: 0,
                                        tonePreset: "neutral",
                                        isMuted: false,
                                        createdAt: 0,
                                        audioUri: `${audioBase}/stem-1.m4a`,
                                    },
                                ],
                                renderedMixUri: `${audioBase}/mix-1.m4a`,
                            },
                        },
                    ],
                },
            ],
        },
    ];
}

describe("rebaseWorkspacesManagedMedia", () => {
    it("heals every managed audio reference (clip, source, stem, mix) onto the live container", () => {
        const healed = rebaseWorkspacesManagedMedia(libraryWith(OLD));
        const clip = healed[0].ideas[0].clips[0];
        expect(clip.audioUri).toBe(`${NEW}/clip-1.m4a`);
        expect(clip.sourceAudioUri).toBe(`${NEW}/clip-1-src.m4a`);
        expect(clip.overdub!.renderedMixUri).toBe(`${NEW}/mix-1.m4a`);
        expect(clip.overdub!.stems[0].audioUri).toBe(`${NEW}/stem-1.m4a`);
    });

    it("returns the same array reference when nothing needs healing (no-op)", () => {
        const input = libraryWith(NEW);
        expect(rebaseWorkspacesManagedMedia(input)).toBe(input);
    });
});

describe("archived workspace package path", () => {
    function archivedWorkspace(archiveBase: string): Workspace {
        return {
            id: "ws-arch",
            title: "archived",
            isArchived: true,
            collections: [],
            ideas: [],
            archiveState: {
                schemaVersion: 1,
                archivedAt: 0,
                archiveUri: `${archiveBase.replace("/audio", "/workspace-archives")}/ws-arch.zip`,
                packageSizeBytes: 0,
                originalAudioBytes: 0,
                originalMetadataBytes: 0,
                archivedMetadataBytes: 0,
                savingsBytes: 0,
                audioFileCount: 0,
                missingFileCount: 0,
            },
        };
    }

    it("heals the archive package URI onto the live container", () => {
        const healed = rebaseWorkspacesManagedMedia([archivedWorkspace(OLD)]);
        expect(healed[0].archiveState!.archiveUri).toBe(
            "file:///doc/songseed/workspace-archives/ws-arch.zip"
        );
    });

    it("relativizes the archive package URI for backup", () => {
        const rel = toRelativeWorkspacesManagedMedia([archivedWorkspace(NEW)]);
        expect(rel[0].archiveState!.archiveUri).toBe("songseed/workspace-archives/ws-arch.zip");
    });
});

describe("toRelativeWorkspacesManagedMedia", () => {
    it("rewrites managed audio references to container-independent relative paths", () => {
        const relativized = toRelativeWorkspacesManagedMedia(libraryWith(NEW));
        const clip = relativized[0].ideas[0].clips[0];
        expect(clip.audioUri).toBe("songseed/audio/clip-1.m4a");
        expect(clip.overdub!.stems[0].audioUri).toBe("songseed/audio/stem-1.m4a");
        expect(clip.overdub!.renderedMixUri).toBe("songseed/audio/mix-1.m4a");
    });
});

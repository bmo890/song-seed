jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///doc/" }));
jest.mock("../manifestSync", () => ({ readManifest: jest.fn(async () => null) }));
jest.mock("../audioStorage", () => ({ loadAudioDurationMs: jest.fn(async () => 1000) }));
jest.mock("../../state/dataSlice", () => ({ normalizeWorkspaces: (workspaces: unknown[]) => workspaces }));
jest.mock("../../state/useStore", () => ({ sanitizePersistedState: (state: unknown) => state }));

import { matchOrphansToEmptyIdeas, ORPHAN_PLACEHOLDER_MAX_GAP_MS, type RecoveredClip } from "../audioRecovery";
import type { Workspace } from "../../types";

const T0 = 1_800_000_000_000;
const MIN = 60_000;

const orphan = (savedAt: number): RecoveredClip => ({
    ideaId: `recovered-idea-${savedAt}`,
    clipId: `recovered-clip-${savedAt}`,
    title: "Recovered",
    audioUri: `file:///songnook/audio/clip-${savedAt}.m4a`,
    fileModifiedAt: savedAt,
});

const placeholder = (startedAt: number, extra: Record<string, unknown> = {}) => ({
    id: `idea-${startedAt}`,
    kind: "clip",
    clips: [],
    createdAt: startedAt,
    lastActivityAt: startedAt,
    ...extra,
});

const library = (ideas: unknown[]) => [{ id: "w1", ideas } as unknown as Workspace];

describe("matchOrphansToEmptyIdeas", () => {
    it("re-attaches a take to the placeholder recorded just before it", () => {
        const { attachments, remaining } = matchOrphansToEmptyIdeas(
            [orphan(T0 + 2 * MIN)],
            library([placeholder(T0)])
        );
        expect(attachments).toEqual([expect.objectContaining({ workspaceId: "w1", ideaId: `idea-${T0}` })]);
        expect(remaining).toEqual([]);
    });

    it("pairs each placeholder once, oldest take first", () => {
        const { attachments, remaining } = matchOrphansToEmptyIdeas(
            [orphan(T0 + 12 * MIN), orphan(T0 + 2 * MIN)],
            library([placeholder(T0), placeholder(T0 + 10 * MIN)])
        );
        expect(attachments.map((a) => a.ideaId)).toEqual([`idea-${T0}`, `idea-${T0 + 10 * MIN}`]);
        expect(remaining).toEqual([]);
    });

    it("leaves takes without a plausible placeholder for the Recovered collection", () => {
        const tooOld = orphan(T0 + ORPHAN_PLACEHOLDER_MAX_GAP_MS + MIN);
        const beforeStart = orphan(T0 - MIN);
        const { attachments, remaining } = matchOrphansToEmptyIdeas(
            [tooOld, beforeStart],
            library([placeholder(T0)])
        );
        expect(attachments).toEqual([]);
        expect(remaining).toEqual([tooOld, beforeStart]);
    });

    it("never touches ideas that already have clips, or sketches", () => {
        const { attachments } = matchOrphansToEmptyIdeas(
            [orphan(T0 + MIN)],
            library([
                placeholder(T0, { clips: [{ id: "c" }] }),
                placeholder(T0 + 10, { kind: "project" }),
            ])
        );
        expect(attachments).toEqual([]);
    });
});

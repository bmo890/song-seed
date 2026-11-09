/**
 * The one door every incoming SongNook archive passes through (data-safety audit
 * 2026-11-02, root cause 5: "one bad incoming file can lock someone out").
 *
 * A `.songnook` file is written by someone else's device: a Send parcel, a shared
 * file, an archive picked in Settings. Before this check, anything with the right
 * `format` and a `workspaces` array was copied into the library as it came, so a
 * `title: null`, a `createdAt` that was missing, or a collection that was its own
 * grandparent was saved and then broke every launch.
 *
 * Here, BEFORE anything is saved or even previewed:
 *  - types are checked field by field; text is text (length-capped), numbers are
 *    finite, flags are booleans, lists are lists of records;
 *  - what can be safely repaired is repaired: a missing or impossible date becomes
 *    the import time (or the item's own other dates), a date from the future is
 *    clamped to now, a bad number takes its default, a collection or take cycle is
 *    cut, a reference to something the file doesn't carry is dropped (the reference,
 *    never the content), a duplicated id is made unique;
 *  - what can't be is refused: not an archive at all.
 *
 * Pure (no I/O, no store); `libraryImport.readSongNookArchive` calls it.
 */
import type {
    ArchiveClipManifest,
    ArchiveClipOverdubManifest,
    ArchiveCollectionManifest,
    ArchiveManifest,
    ArchiveNotepadNoteManifest,
    ArchiveShareDeclaration,
    ArchiveSongManifest,
    ArchiveStandaloneClipManifest,
    ArchiveWorkspaceManifest,
} from "../services/libraryArchiveManifest";
import type { ArchiveWarning, ArchiveWarningCode } from "../services/archiveWarnings";
import type {
    ClipGroup,
    CustomTagDefinition,
    IdeasListState,
    IdeaStatus,
    LyricsVersion,
    Playlist,
    ReceivedMeta,
    Setlist,
    ShareKind,
    Songbook,
} from "../types";
import { breakParentCycles } from "./parentLinks";
import { normalizeHiddenDays } from "./hiddenDayGroups";

export { breakParentCycles, hasParentCycle } from "./parentLinks";

/** The two format ids an archive may carry (the pre-rename one is still accepted). */
const ARCHIVE_FORMATS = new Set(["songnook-archive", "song-nook-archive"]);

export class IncomingArchiveError extends Error {
    constructor(message = "This file is not a valid SongNook Archive.") {
        super(message);
        this.name = "IncomingArchiveError";
    }
}

export type IncomingArchiveOptions = {
    /** The import's clock; every repaired or future date becomes this. */
    now?: number;
    /** Title for a named thing whose title isn't text (translated by the caller). */
    untitled?: string;
};

export type CheckedArchive = {
    manifest: ArchiveManifest;
    /** How many fields were repaired (for the persist log; 0 for a clean file). */
    repairs: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Zero or less is a lost date (NaN saved as JSON reads back as null → 0 → 1970). */
const DATE_FLOOR = 1;
const TITLE_MAX = 300;
const TEXT_MAX = 200_000;
const ID_MAX = 200;
const PEAKS_MAX = 8192;

const IDEA_STATUSES: ReadonlySet<string> = new Set<IdeaStatus>(["seed", "sprout", "stem", "song", "clip"]);
const SHARE_KINDS: ReadonlySet<string> = new Set<ShareKind>([
    "setlist", "playlist", "songbook", "sketch", "collection", "workspace", "clips", "library",
]);

const WARNING_CODES: ReadonlySet<string> = new Set<ArchiveWarningCode>([
    "missingClipAudio", "missingSourceAudio", "missingPrimaryTake", "missingOverdubMix", "missingOverdubStem",
    "missingFile", "missingArchivedAudio", "missingArchivedSourceAudio", "missingArchivedOverdubMix",
    "missingArchivedOverdubStem", "text",
]);

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): Rec[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

class Checker {
    repairs = 0;
    private readonly now: number;
    private readonly untitled: string;
    private syntheticCount = 0;
    private readonly seen = {
        workspace: new Set<string>(),
        collection: new Set<string>(),
        idea: new Set<string>(),
        clip: new Set<string>(),
    };

    constructor(options: IncomingArchiveOptions) {
        this.now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
        this.untitled = options.untitled || "Untitled";
    }

    private repaired<T>(value: T): T {
        this.repairs += 1;
        return value;
    }

    // ── primitives ──────────────────────────────────────────────────────────

    text(value: unknown, max = TEXT_MAX): string {
        if (typeof value === "string") return value.length > max ? this.repaired(value.slice(0, max)) : value;
        if (value == null) return "";
        if (typeof value === "number" && Number.isFinite(value)) return this.repaired(String(value));
        return this.repaired("");
    }

    optionalText(value: unknown, max = TEXT_MAX): string | undefined {
        if (value == null) return undefined;
        if (typeof value === "string") return value.length > max ? this.repaired(value.slice(0, max)) : value;
        return this.repaired(undefined);
    }

    nullableText(value: unknown, max = TITLE_MAX): string | null {
        if (value == null) return null;
        if (typeof value === "string") return value.slice(0, max);
        return this.repaired(null);
    }

    title(value: unknown): string {
        if (typeof value === "string") return value.length > TITLE_MAX ? this.repaired(value.slice(0, TITLE_MAX)) : value;
        if (typeof value === "number" && Number.isFinite(value)) return this.repaired(String(value));
        return this.repaired(this.untitled);
    }

    flag(value: unknown): boolean {
        if (typeof value === "boolean") return value;
        if (value != null) this.repairs += 1;
        return Boolean(value === 1 || value === "true");
    }

    optionalFlag(value: unknown): boolean | undefined {
        return value == null ? undefined : this.flag(value);
    }

    number(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value < min ? this.repaired(min) : value > max ? this.repaired(max) : value;
        }
        return value == null ? fallback : this.repaired(fallback);
    }

    optionalNumber(value: unknown, min = -Infinity, max = Infinity): number | undefined {
        if (value == null) return undefined;
        if (typeof value === "number" && Number.isFinite(value)) {
            return value < min ? this.repaired(min) : value > max ? this.repaired(max) : value;
        }
        return this.repaired(undefined);
    }

    peaks(value: unknown): number[] | undefined {
        if (value == null) return undefined;
        if (!Array.isArray(value)) return this.repaired(undefined);
        const out = value.slice(0, PEAKS_MAX).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
        if (out.length !== value.length) this.repairs += 1;
        return out.length > 0 ? out : undefined;
    }

    /** A date as epoch ms, or undefined when it isn't one (missing, NaN, before 1980). */
    private readDate(value: unknown): number | undefined {
        let ms: number;
        if (typeof value === "number") ms = value;
        else if (typeof value === "string" && value.trim().length > 0) {
            const asNumber = Number(value);
            ms = Number.isFinite(asNumber) ? asNumber : Date.parse(value);
        } else return undefined;
        return Number.isFinite(ms) && ms >= DATE_FLOOR ? Math.round(ms) : undefined;
    }

    /** A required date: repaired to `fallback` (default: the import time); never in the future. */
    date(value: unknown, fallback?: number): number {
        const read = this.readDate(value);
        if (read === undefined) return this.repaired(fallback ?? this.now);
        if (typeof value !== "number") this.repairs += 1;
        return read > this.now + DAY_MS ? this.repaired(this.now) : read;
    }

    optionalDate(value: unknown): number | undefined {
        if (value == null) return undefined;
        const read = this.readDate(value);
        if (read === undefined) return this.repaired(undefined);
        return read > this.now + DAY_MS ? this.repaired(this.now) : read;
    }

    /** The earliest real date among candidates, if any. */
    earliestDate(values: unknown[]): number | undefined {
        let best: number | undefined;
        for (const value of values) {
            const read = this.readDate(value);
            if (read !== undefined && read <= this.now + DAY_MS && (best === undefined || read < best)) best = read;
        }
        return best;
    }

    /** A source id, unique within its kind across the whole file. */
    id(value: unknown, kind: keyof Checker["seen"]): string {
        const seen = this.seen[kind];
        let id =
            typeof value === "string" && value.length > 0 && value.length <= ID_MAX
                ? value
                : typeof value === "number" && Number.isFinite(value)
                    ? String(value)
                    : "";
        if (id === "" || seen.has(id)) {
            this.repairs += 1;
            do {
                this.syntheticCount += 1;
                id = `incoming-${kind}-${this.syntheticCount}`;
            } while (seen.has(id));
        }
        seen.add(id);
        return id;
    }

    /** A reference id (pointing at something else): kept as text, else dropped. */
    ref(value: unknown): string | undefined {
        if (typeof value === "string" && value.length > 0 && value.length <= ID_MAX) return value;
        return value == null ? undefined : this.repaired(undefined);
    }

    /** A list of records, or [] (repaired when it wasn't a list, or held junk). */
    list(value: unknown): Rec[] {
        if (value == null) return [];
        if (!Array.isArray(value)) return this.repaired([]);
        const kept = records(value);
        if (kept.length !== value.length) this.repairs += 1;
        return kept;
    }

    // ── shapes ──────────────────────────────────────────────────────────────

    status(value: unknown, fallback: IdeaStatus): IdeaStatus {
        if (typeof value === "string" && (IDEA_STATUSES.has(value) || value === "semi")) return value as IdeaStatus;
        return value == null ? fallback : this.repaired(fallback);
    }

    customTags(value: unknown): CustomTagDefinition[] | undefined {
        if (value == null) return undefined;
        const tags = this.list(value)
            .filter((tag) => typeof tag.key === "string" && tag.key.length > 0)
            .map((tag) => ({
                key: (tag.key as string).slice(0, ID_MAX),
                label: this.text(tag.label, TITLE_MAX),
                color: typeof tag.color === "string" ? tag.color.slice(0, 32) : "",
            }));
        return tags.length > 0 ? tags : undefined;
    }

    stringList(value: unknown, max = TITLE_MAX): string[] | undefined {
        if (value == null) return undefined;
        if (!Array.isArray(value)) return this.repaired(undefined);
        const out = value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.slice(0, max));
        if (out.length !== value.length) this.repairs += 1;
        return out;
    }

    stringMap(value: unknown): Record<string, string> | undefined {
        if (value == null) return undefined;
        if (!isRecord(value)) return this.repaired(undefined);
        const out: Record<string, string> = {};
        for (const [key, entry] of Object.entries(value)) {
            if (typeof entry === "string" && entry.length > 0) out[key] = entry;
            else this.repairs += 1;
        }
        return out;
    }

    ideasListState(value: unknown): IdeasListState | undefined {
        if (value == null) return undefined;
        if (!isRecord(value)) return this.repaired(undefined);
        return {
            hiddenIdeaIds: this.stringList(value.hiddenIdeaIds, ID_MAX) ?? [],
            hiddenDays: normalizeHiddenDays(value.hiddenDays),
        };
    }

    received(value: unknown): ReceivedMeta | undefined {
        if (value == null) return undefined;
        if (!isRecord(value)) return this.repaired(undefined);
        const openedAt = this.optionalDate(value.openedAt);
        const message = typeof value.message === "string" ? value.message.trim().slice(0, 1000) : "";
        return {
            senderName: this.nullableText(value.senderName),
            senderUserId: this.nullableText(value.senderUserId),
            transferId: this.nullableText(value.transferId),
            receivedAt: this.date(value.receivedAt),
            shareKind: typeof value.shareKind === "string" && SHARE_KINDS.has(value.shareKind)
                ? (value.shareKind as ShareKind)
                : this.repaired("library"),
            shareTitle: this.title(value.shareTitle),
            ...(openedAt !== undefined ? { openedAt } : null),
            ...(message ? { message } : null),
        };
    }

    /** Only the primitive fields of a chord survive; its text and anchors are typed. */
    private chord(value: Rec, lineIndex: number, chordIndex: number) {
        const out: Rec = {};
        for (const [key, entry] of Object.entries(value)) {
            if (typeof entry === "string" || (typeof entry === "number" && Number.isFinite(entry)) || typeof entry === "boolean") {
                out[key] = entry;
            }
        }
        out.id = typeof value.id === "string" && value.id.length > 0 ? value.id : `chord-${lineIndex + 1}-${chordIndex + 1}`;
        out.chord = this.text(value.chord, 64);
        out.at = this.number(value.at, 0, 0);
        if (value.graphemeAt != null) out.graphemeAt = this.number(value.graphemeAt, 0, 0);
        return out;
    }

    lyricsVersions(value: unknown): LyricsVersion[] | undefined {
        if (value == null) return undefined;
        const seenIds = new Set<string>();
        return this.list(value).map((version, versionIndex) => {
            let id = typeof version.id === "string" && version.id.length > 0 ? version.id : "";
            if (id === "" || seenIds.has(id)) id = this.repaired(`incoming-lyrics-${versionIndex + 1}-${this.syntheticCount++}`);
            seenIds.add(id);
            const createdAt = this.date(version.createdAt);
            const document = isRecord(version.document) ? version.document : {};
            return {
                id,
                createdAt,
                updatedAt: this.date(version.updatedAt, createdAt),
                textDirection:
                    version.textDirection === "ltr" || version.textDirection === "rtl" ? version.textDirection : "auto",
                document: {
                    lines: this.list(document.lines).map((line, lineIndex) => ({
                        id: typeof line.id === "string" && line.id.length > 0 ? line.id : `line-${lineIndex + 1}`,
                        text: this.text(line.text, 4000),
                        chords: this.list(line.chords).map((chord, chordIndex) => this.chord(chord, lineIndex, chordIndex)),
                    })),
                },
            } as LyricsVersion;
        });
    }

    clipGroups(value: unknown): ClipGroup[] | undefined {
        if (value == null) return undefined;
        const seenIds = new Set<string>();
        return this.list(value)
            .filter((group) => {
                if (typeof group.id !== "string" || group.id.length === 0 || seenIds.has(group.id)) return this.repaired(false);
                seenIds.add(group.id);
                return true;
            })
            .map((group) => {
                const createdAt = this.date(group.createdAt);
                return {
                    id: group.id as string,
                    name: this.text(group.name, TITLE_MAX),
                    collapsed: this.flag(group.collapsed),
                    createdAt,
                    updatedAt: this.date(group.updatedAt, createdAt),
                };
            });
    }

    /** A container the store's own normalizers know how to read: kept only when its shape is right. */
    passRecord<T>(value: unknown): T | undefined {
        if (value == null) return undefined;
        return isRecord(value) ? (value as T) : this.repaired(undefined);
    }

    passList<T>(value: unknown): T[] | undefined {
        if (value == null) return undefined;
        if (!Array.isArray(value)) return this.repaired(undefined);
        const kept = records(value);
        if (kept.length !== value.length) this.repairs += 1;
        return kept as T[];
    }

    overdub(value: unknown): ArchiveClipOverdubManifest | undefined {
        if (value == null) return undefined;
        if (!isRecord(value)) return this.repaired(undefined);
        const root = isRecord(value.root)
            ? { gainDb: this.number(value.root.gainDb, 0, -60, 24), tonePreset: this.text(value.root.tonePreset, 64) }
            : undefined;
        return {
            root,
            renderedMixPath: this.optionalText(value.renderedMixPath, 1024),
            renderedMixDurationMs: this.optionalNumber(value.renderedMixDurationMs, 0),
            renderedMixWaveformPeaks: this.peaks(value.renderedMixWaveformPeaks),
            stems: this.list(value.stems).map((stem) => ({
                id: this.text(stem.id, ID_MAX),
                title: this.title(stem.title),
                gainDb: this.number(stem.gainDb, 0, -60, 24),
                offsetMs: this.number(stem.offsetMs, 0),
                tonePreset: this.text(stem.tonePreset, 64),
                isMuted: this.flag(stem.isMuted),
                durationMs: this.optionalNumber(stem.durationMs, 0),
                waveformPeaks: this.peaks(stem.waveformPeaks),
                recordingGrid: this.passRecord(stem.recordingGrid),
                recordedOffsetMs: this.optionalNumber(stem.recordedOffsetMs),
                audioPath: this.optionalText(stem.audioPath, 1024),
                audioMissing: this.optionalFlag(stem.audioMissing),
                color: this.optionalText(stem.color, 32),
                createdAt: this.optionalDate(stem.createdAt),
            })),
        };
    }

    /** One take. `fallbackDate` is the owning idea's date (for a take without its own).
     *  `asTake` false: the entry is a clip idea's own record, its id the idea's. */
    clip(value: Rec, fallbackDate: number, asTake = true): ArchiveClipManifest {
        return {
            id: asTake ? this.id(value.id, "clip") : this.text(value.id, ID_MAX),
            title: this.title(value.title),
            createdAt: this.date(value.createdAt, fallbackDate),
            isPrimary: this.flag(value.isPrimary),
            isBookmarked: this.optionalFlag(value.isBookmarked),
            parentClipId: this.ref(value.parentClipId),
            durationMs: this.optionalNumber(value.durationMs, 0),
            notes: this.optionalText(value.notes),
            audioPath: this.optionalText(value.audioPath, 1024),
            audioMissing: this.optionalFlag(value.audioMissing),
            overdub: this.overdub(value.overdub),
            recordingGrid: this.passRecord(value.recordingGrid),
            editRegions: this.passList(value.editRegions),
            isTitleAutoGenerated: this.optionalFlag(value.isTitleAutoGenerated),
            importedAt: this.optionalDate(value.importedAt),
            sourceCreatedAt: this.optionalDate(value.sourceCreatedAt),
            parentAssignedAt: this.optionalDate(value.parentAssignedAt),
            waveformPeaks: this.peaks(value.waveformPeaks),
            sourceAudioPath: this.optionalText(value.sourceAudioPath, 1024),
            tags: this.stringList(value.tags),
            practiceMarkers: this.passList(value.practiceMarkers),
            keptPractice: this.passRecord(value.keptPractice),
            sections: this.passList(value.sections),
            analysis: this.passRecord(value.analysis),
            lyricsVersionId: this.ref(value.lyricsVersionId),
            manualSortOrder: this.optionalNumber(value.manualSortOrder),
        };
    }

    /**
     * A set of takes that belong together (one sketch, or one clip idea's takes):
     * lineage kept only inside the set and never in a loop, exactly one primary,
     * lyric stamps only for versions the sketch carries.
     */
    takes(clips: ArchiveClipManifest[], lyricVersionIds: ReadonlySet<string>): ArchiveClipManifest[] {
        const parentOf = new Map<string, string | null | undefined>(clips.map((clip) => [clip.id, clip.parentClipId]));
        this.repairs += breakParentCycles(parentOf);
        let primarySeen = false;
        return clips.map((clip) => {
            const parentClipId = parentOf.get(clip.id) ?? undefined;
            const isPrimary = clip.isPrimary && !primarySeen;
            if (clip.isPrimary && primarySeen) this.repairs += 1;
            primarySeen = primarySeen || isPrimary;
            const lyricsVersionId =
                clip.lyricsVersionId && lyricVersionIds.has(clip.lyricsVersionId) ? clip.lyricsVersionId : undefined;
            if (clip.lyricsVersionId && !lyricsVersionId) this.repairs += 1;
            return { ...clip, parentClipId, isPrimary, lyricsVersionId };
        });
    }

    song(value: Rec): ArchiveSongManifest {
        const id = this.id(value.id, "idea");
        const rawClips = this.list(value.clips);
        // A sketch without its own date takes its earliest take's, else the import time.
        const createdAt = this.date(
            value.createdAt,
            this.earliestDate(rawClips.map((clip) => clip.createdAt)) ?? this.optionalDate(value.importedAt) ?? this.now
        );
        const lyricsVersions = this.lyricsVersions(value.lyricsVersions);
        const lyricVersionIds = new Set((lyricsVersions ?? []).map((version) => version.id));
        const clips = this.takes(rawClips.map((clip) => this.clip(clip, createdAt)), lyricVersionIds);
        const clipIds = new Set(clips.map((clip) => clip.id));
        const assignments = this.stringMap(value.clipGroupAssignments);
        const clipGroups = this.clipGroups(value.clipGroups);
        const groupIds = new Set((clipGroups ?? []).map((group) => group.id));
        const clipGroupAssignments = assignments
            ? Object.fromEntries(
                  Object.entries(assignments).filter(([clipId, groupId]) => clipIds.has(clipId) && groupIds.has(groupId))
              )
            : undefined;
        return {
            id,
            title: this.title(value.title),
            folderPath: this.text(value.folderPath, 1024),
            collectionId: this.text(value.collectionId, ID_MAX),
            createdAt,
            lastActivityAt: this.date(value.lastActivityAt, createdAt),
            completionPct: this.number(value.completionPct, 0, 0, 100),
            isBookmarked: this.flag(value.isBookmarked),
            notes: this.optionalText(value.notes),
            lyrics: this.optionalText(value.lyrics),
            historyIncluded: this.flag(value.historyIncluded),
            songGrid: this.passRecord(value.songGrid),
            songGridUpdatedAt: this.optionalDate(value.songGridUpdatedAt),
            clips,
            status: value.status == null ? undefined : this.status(value.status, "song"),
            isDraft: this.optionalFlag(value.isDraft),
            isTitleAutoGenerated: this.optionalFlag(value.isTitleAutoGenerated),
            importedAt: this.optionalDate(value.importedAt),
            sourceCreatedAt: this.optionalDate(value.sourceCreatedAt),
            customTags: this.customTags(value.customTags),
            clipGroups,
            clipGroupAssignments,
            lyricsVersions,
            chordPalette: this.passList(value.chordPalette),
            chordSheet: this.passRecord(value.chordSheet),
        };
    }

    standaloneClip(value: Rec): ArchiveStandaloneClipManifest {
        const rawTakes = value.takes == null ? undefined : this.list(value.takes);
        const idea = isRecord(value.idea) ? value.idea : value.idea == null ? undefined : this.repaired(undefined);
        const createdAt = this.date(
            value.createdAt,
            this.earliestDate([...(rawTakes ?? []).map((take) => take.createdAt), idea?.importedAt, value.importedAt]) ?? this.now
        );
        // The entry's own id is the IDEA's source id (setlists and playlists point at it).
        const ideaId = this.id(value.id, "idea");
        const base = this.clip(value, createdAt, false);
        const takes = rawTakes ? this.takes(rawTakes.map((take) => this.clip(take, createdAt)), new Set()) : undefined;
        return {
            ...base,
            id: ideaId,
            createdAt,
            parentClipId: undefined,
            lyricsVersionId: undefined,
            takes: takes && takes.length > 0 ? takes : undefined,
            idea: idea
                ? {
                      status: idea.status == null ? undefined : this.status(idea.status, "clip"),
                      completionPct: this.optionalNumber(idea.completionPct, 0, 100),
                      lastActivityAt: this.optionalDate(idea.lastActivityAt),
                      isTitleAutoGenerated: this.optionalFlag(idea.isTitleAutoGenerated),
                      isDraft: this.optionalFlag(idea.isDraft),
                      importedAt: this.optionalDate(idea.importedAt),
                      sourceCreatedAt: this.optionalDate(idea.sourceCreatedAt),
                      customTags: this.customTags(idea.customTags),
                  }
                : undefined,
        };
    }

    collections(values: Rec[]): ArchiveCollectionManifest[] {
        const collections = values.map((value): ArchiveCollectionManifest => ({
            id: this.id(value.id, "collection"),
            title: this.title(value.title),
            parentCollectionId: this.ref(value.parentCollectionId) ?? null,
            folderPath: this.text(value.folderPath, 1024),
            songs: this.list(value.songs).map((song) => this.song(song)),
            standaloneClips: this.list(value.standaloneClips).map((clip) => this.standaloneClip(clip)),
            description: this.optionalText(value.description, 4000),
            createdAt: this.optionalDate(value.createdAt),
            updatedAt: this.optionalDate(value.updatedAt),
            ideasListState: this.ideasListState(value.ideasListState),
        }));
        // A parent the workspace doesn't carry, or a loop, makes the collection top level.
        const parentOf = new Map<string, string | null | undefined>(
            collections.map((collection) => [collection.id, collection.parentCollectionId])
        );
        this.repairs += breakParentCycles(parentOf);
        return collections.map((collection) => ({ ...collection, parentCollectionId: parentOf.get(collection.id) ?? null }));
    }

    workspace(value: Rec): ArchiveWorkspaceManifest {
        const origin = value.origin === "personal" || value.origin === "received" || value.origin === "shared"
            ? value.origin
            : value.origin == null ? undefined : this.repaired(undefined);
        return {
            id: this.id(value.id, "workspace"),
            title: this.title(value.title),
            description: this.optionalText(value.description, 4000),
            isArchived: this.optionalFlag(value.isArchived),
            folderPath: this.text(value.folderPath, 1024),
            collections: this.collections(this.list(value.collections)),
            color: this.optionalText(value.color, 32),
            avatarKey: this.optionalNumber(value.avatarKey, 0, 10_000),
            origin,
            received: origin === "received" ? this.received(value.received) : undefined,
            ideasListState: this.ideasListState(value.ideasListState),
        };
    }

    note(value: Rec): ArchiveNotepadNoteManifest {
        const createdAt = this.date(value.createdAt, this.optionalDate(value.updatedAt));
        return {
            id: this.text(value.id, ID_MAX),
            title: this.text(value.title, TITLE_MAX),
            body: this.text(value.body),
            createdAt,
            updatedAt: this.date(value.updatedAt, createdAt),
            isPinned: this.flag(value.isPinned),
            textDirection: value.textDirection === "ltr" || value.textDirection === "rtl" ? value.textDirection : undefined,
        };
    }

    /** A compilation's references are typed here; import drops the ones the file doesn't carry. */
    songbook(value: Rec): Songbook {
        const createdAt = this.date(value.createdAt);
        return {
            id: this.text(value.id, ID_MAX),
            title: this.title(value.title),
            createdAt,
            updatedAt: this.date(value.updatedAt, createdAt),
            received: this.received(value.received),
            items: this.list(value.items)
                .filter((item) => typeof item.workspaceId === "string" && typeof item.ideaId === "string")
                .map((item) => ({
                    id: this.text(item.id, ID_MAX),
                    kind: item.kind === "chordChart" ? "chordChart" : "lyricChart",
                    workspaceId: item.workspaceId as string,
                    ideaId: item.ideaId as string,
                    versionId: this.ref(item.versionId),
                    addedAt: this.date(item.addedAt, createdAt),
                })),
        };
    }

    setlist(value: Rec): Setlist {
        const createdAt = this.date(value.createdAt);
        return {
            id: this.text(value.id, ID_MAX),
            title: this.title(value.title),
            description: this.optionalText(value.description, 4000),
            createdAt,
            updatedAt: this.date(value.updatedAt, createdAt),
            received: this.received(value.received),
            entries: this.list(value.entries)
                .filter((entry) => typeof entry.workspaceId === "string" && typeof entry.ideaId === "string")
                .map((entry) => ({
                    id: this.text(entry.id, ID_MAX),
                    workspaceId: entry.workspaceId as string,
                    ideaId: entry.ideaId as string,
                    clipIds: this.stringList(entry.clipIds, ID_MAX) ?? [],
                    lyricVersionIds: this.stringList(entry.lyricVersionIds, ID_MAX) ?? [],
                    includeChordSheet: this.flag(entry.includeChordSheet),
                    includeSongNotes: this.optionalFlag(entry.includeSongNotes),
                    addedAt: this.date(entry.addedAt, createdAt),
                })),
        };
    }

    playlist(value: Rec): Playlist {
        const createdAt = this.date(value.createdAt);
        return {
            id: this.text(value.id, ID_MAX),
            title: this.title(value.title),
            createdAt,
            updatedAt: this.date(value.updatedAt, createdAt),
            received: this.received(value.received),
            items: this.list(value.items)
                .filter(
                    (item) =>
                        typeof item.workspaceId === "string" &&
                        typeof item.ideaId === "string" &&
                        typeof item.collectionId === "string"
                )
                .map((item) => ({
                    id: this.text(item.id, ID_MAX),
                    kind: item.kind === "song" ? "song" : "clip",
                    workspaceId: item.workspaceId as string,
                    collectionId: item.collectionId as string,
                    ideaId: item.ideaId as string,
                    clipId: this.ref(item.clipId) ?? null,
                    addedAt: this.date(item.addedAt, createdAt),
                })),
        };
    }

    share(value: unknown): ArchiveShareDeclaration | undefined {
        if (value == null) return undefined;
        if (!isRecord(value)) return this.repaired(undefined);
        const sender = isRecord(value.sender) ? value.sender : {};
        return {
            kind: typeof value.kind === "string" && SHARE_KINDS.has(value.kind) ? (value.kind as ShareKind) : this.repaired("library"),
            title: this.title(value.title),
            sender: { name: this.nullableText(sender.name), userId: this.nullableText(sender.userId) },
            transferId: this.nullableText(value.transferId),
            createdAt: this.date(value.createdAt),
            appVersion: this.optionalText(value.appVersion, 64),
        };
    }

    warningEntries(value: unknown): ArchiveWarning[] | undefined {
        if (value == null) return undefined;
        const entries = this.list(value)
            .filter((entry) => typeof entry.code === "string" && WARNING_CODES.has(entry.code))
            .map((entry) => {
                const params: Record<string, string> = {};
                if (isRecord(entry.params)) {
                    for (const [key, param] of Object.entries(entry.params)) {
                        if (typeof param === "string") params[key] = param.slice(0, TITLE_MAX);
                        else if (typeof param === "number" && Number.isFinite(param)) params[key] = String(param);
                    }
                }
                return { code: entry.code as ArchiveWarningCode, params };
            });
        return entries;
    }
}

/**
 * Check, repair or refuse an archive's `manifest.json` (already parsed). Throws
 * `IncomingArchiveError` when the value isn't a SongNook archive at all.
 */
export function checkIncomingArchiveManifest(raw: unknown, options: IncomingArchiveOptions = {}): CheckedArchive {
    if (!isRecord(raw)) throw new IncomingArchiveError();
    if (typeof raw.format !== "string" || !ARCHIVE_FORMATS.has(raw.format)) throw new IncomingArchiveError();
    if (!Array.isArray(raw.workspaces)) throw new IncomingArchiveError();

    const check = new Checker(options);
    const workspaces = check.list(raw.workspaces).map((workspace) => check.workspace(workspace));
    const notepadNotes = raw.notepadNotes == null ? undefined : check.list(raw.notepadNotes).map((note) => check.note(note));
    const prefs = isRecord(raw.libraryPreferences) ? raw.libraryPreferences : undefined;
    const scope = isRecord(raw.scope) ? raw.scope : {};

    let collections = 0;
    let songs = 0;
    let standaloneClips = 0;
    for (const workspace of workspaces) {
        collections += workspace.collections.length;
        for (const collection of workspace.collections) {
            songs += collection.songs.length;
            standaloneClips += collection.standaloneClips.length;
        }
    }

    const manifest: ArchiveManifest = {
        format: "songnook-archive",
        schemaVersion: check.number(raw.schemaVersion, 1, 0, 1000),
        fidelity: raw.fidelity === "full" ? "full" : raw.fidelity == null ? undefined : "standard",
        exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt.slice(0, 64) : new Date(options.now ?? Date.now()).toISOString(),
        options: check.passRecord(raw.options),
        libraryPreferences: prefs
            ? {
                  primaryWorkspaceId: check.ref(prefs.primaryWorkspaceId) ?? null,
                  primaryCollectionIdByWorkspace: check.stringMap(prefs.primaryCollectionIdByWorkspace) ?? {},
                  bluetoothMonitoringCalibrations: check.passList(prefs.bluetoothMonitoringCalibrations),
              }
            : undefined,
        scope: {
            workspaceIds: check.stringList(scope.workspaceIds, ID_MAX) ?? [],
            collectionIds: check.stringList(scope.collectionIds, ID_MAX) ?? [],
            excludedCollectionIds: check.stringList(scope.excludedCollectionIds, ID_MAX),
        },
        warnings: check.stringList(raw.warnings, 1000),
        warningEntries: check.warningEntries(raw.warningEntries),
        // Counted from what is really inside, never trusted from the file (the preview shows them).
        summary: { workspaces: workspaces.length, collections, songs, standaloneClips, notepadNotes: notepadNotes?.length },
        notepadNotes,
        workspaces,
        songbooks: raw.songbooks == null ? undefined : check.list(raw.songbooks).map((value) => check.songbook(value)),
        setlists: raw.setlists == null ? undefined : check.list(raw.setlists).map((value) => check.setlist(value)),
        playlists: raw.playlists == null ? undefined : check.list(raw.playlists).map((value) => check.playlist(value)),
        share: check.share(raw.share),
    };
    return { manifest, repairs: check.repairs };
}

/**
 * Ids for everything an import creates, checked against every id already in the
 * library (all workspaces, all kinds) and every id minted so far in this import,
 * so a new item can never share an identity with an existing one.
 */
export type UniqueIdMinter = {
    (prefix: string): string;
    /** Mark ids as taken (the library as it stands when an import starts). */
    reserve: (ids: Iterable<string>) => void;
};

export function createUniqueIdMinter(taken: Iterable<string> = [], random: () => number = Math.random): UniqueIdMinter {
    const used = new Set(taken);
    const mint = ((prefix: string): string => {
        let id: string;
        do {
            id = `${prefix}-${Date.now()}-${random().toString(36).slice(2, 9)}`;
        } while (used.has(id));
        used.add(id);
        return id;
    }) as UniqueIdMinter;
    mint.reserve = (ids) => {
        for (const id of ids) used.add(id);
    };
    return mint;
}

/** Every id a library already holds: workspaces, collections, ideas, takes, layers. */
export function collectLibraryIds(
    workspaces: ReadonlyArray<{
        id: string;
        collections?: ReadonlyArray<{ id: string }>;
        ideas?: ReadonlyArray<{ id: string; clips?: ReadonlyArray<{ id: string; overdub?: { stems?: ReadonlyArray<{ id: string }> } }> }>;
    }>
): Set<string> {
    const ids = new Set<string>();
    for (const workspace of workspaces) {
        ids.add(workspace.id);
        for (const collection of workspace.collections ?? []) ids.add(collection.id);
        for (const idea of workspace.ideas ?? []) {
            ids.add(idea.id);
            for (const clip of idea.clips ?? []) {
                ids.add(clip.id);
                for (const stem of clip.overdub?.stems ?? []) ids.add(stem.id);
            }
        }
    }
    return ids;
}

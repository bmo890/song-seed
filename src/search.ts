import { getCollectionAncestors, getCollectionById } from "./utils";
import { deriveNotePreviewBody, deriveNotePreviewTitle } from "./notepad";
import type { Note, SongIdea, Workspace } from "./types";

export type GlobalSearchResultKind = "song" | "clip" | "note" | "collection" | "workspace";
export type GlobalSearchMatchSource =
  | "title"
  | "description"
  | "notes"
  | "clip-title"
  | "clip-notes"
  | "lyrics"
  | "chords"
  | "body";

export type GlobalSearchResult = {
  id: string;
  kind: GlobalSearchResultKind;
  title: string;
  context: string;
  matchSource: GlobalSearchMatchSource;
  snippet: string | null;
  score: number;
  updatedAt: number;
  workspaceId?: string;
  collectionId?: string;
  ideaId?: string;
  noteId?: string;
  isPinned?: boolean;
};

type SearchField = {
  source: GlobalSearchMatchSource;
  text: string;
  baseScore: number;
  snippetText?: string | null;
  snippetPrefix?: string | null;
};

type SearchFieldMatch = {
  source: GlobalSearchMatchSource;
  score: number;
  snippet: string | null;
};

export const GLOBAL_SEARCH_KIND_ORDER: GlobalSearchResultKind[] = [
  "song",
  "clip",
  "note",
  "collection",
  "workspace",
];

function normalizeNeedle(query: string) {
  return query.trim().toLowerCase();
}

function buildSnippet(text: string, needle: string, prefix?: string | null) {
  const source = text.trim();
  if (!source) return null;

  const lowerSource = source.toLowerCase();
  const matchIndex = lowerSource.indexOf(needle);
  const baseSnippet =
    matchIndex >= 0
      ? source.slice(Math.max(0, matchIndex - 28), Math.min(source.length, matchIndex + needle.length + 52))
      : source.slice(0, 80);
  const compact = baseSnippet.replace(/\s+/g, " ").trim();

  if (!compact) return null;

  const leadingEllipsis = matchIndex > 28 ? "..." : "";
  const trailingEllipsis =
    matchIndex >= 0 && matchIndex + needle.length + 52 < source.length ? "..." : compact.length < source.length ? "..." : "";
  const summary = `${leadingEllipsis}${compact}${trailingEllipsis}`;

  return prefix ? `${prefix}: ${summary}` : summary;
}

function getTextMatchScore(text: string, needle: string, baseScore: number) {
  const source = text.trim();
  if (!source) return null;

  const lowerSource = source.toLowerCase();
  const matchIndex = lowerSource.indexOf(needle);
  if (matchIndex < 0) return null;

  let score = baseScore;
  if (lowerSource === needle) score += 50;
  if (matchIndex === 0) score += 25;
  if (lowerSource.startsWith(`${needle} `)) score += 10;
  score -= Math.min(matchIndex, 18);

  return score;
}

function findBestFieldMatch(fields: SearchField[], needle: string): SearchFieldMatch | null {
  let best: SearchFieldMatch | null = null;

  for (const field of fields) {
    const score = getTextMatchScore(field.text, needle, field.baseScore);
    if (score == null) continue;

    const next: SearchFieldMatch = {
      source: field.source,
      score,
      snippet: buildSnippet(field.snippetText ?? field.text, needle, field.snippetPrefix),
    };

    if (!best || next.score > best.score) {
      best = next;
    }
  }

  return best;
}

function buildCollectionPath(workspace: Workspace, collectionId: string) {
  const collection = getCollectionById(workspace, collectionId);
  if (!collection) {
    return workspace.title;
  }

  const pathTitles = [...getCollectionAncestors(workspace, collectionId), collection].map((item) => item.title);
  return `${workspace.title} • ${pathTitles.join(" / ")}`;
}

function buildCollectionParentPath(workspace: Workspace, collectionId: string) {
  const ancestors = getCollectionAncestors(workspace, collectionId);
  if (ancestors.length === 0) {
    return workspace.title;
  }

  return `${workspace.title} • ${ancestors.map((item) => item.title).join(" / ")}`;
}

function buildIdeaSearchFields(idea: SongIdea): SearchField[] {
  const fields: SearchField[] = [
    { source: "title", text: idea.title, baseScore: 120 },
    { source: "notes", text: idea.notes, baseScore: 90 },
  ];

  for (const clip of idea.clips) {
    fields.push({
      source: "clip-title",
      text: clip.title,
      baseScore: 84,
      snippetText: clip.title,
      snippetPrefix: "Clip",
    });
    fields.push({
      source: "clip-notes",
      text: clip.notes,
      baseScore: 80,
      snippetText: clip.notes,
      snippetPrefix: clip.title.trim() || "Clip",
    });
  }

  if (idea.kind === "project" && idea.lyrics?.versions?.length) {
    for (const version of idea.lyrics.versions) {
      for (const line of version.document.lines) {
        fields.push({
          source: "lyrics",
          text: line.text,
          baseScore: 76,
        });
        for (const chord of line.chords) {
          fields.push({
            source: "chords",
            text: chord.chord,
            baseScore: 70,
            snippetText: line.text || chord.chord,
            snippetPrefix: "Chord",
          });
        }
      }
    }
  }

  return fields;
}

export function getSearchMatchSourceLabel(source: GlobalSearchMatchSource) {
  switch (source) {
    case "title":
      return "Title";
    case "description":
      return "Description";
    case "notes":
      return "Notes";
    case "clip-title":
      return "Clip title";
    case "clip-notes":
      return "Clip notes";
    case "lyrics":
      return "Lyrics";
    case "chords":
      return "Chords";
    case "body":
    default:
      return "Body";
  }
}

export function getSearchResultKindLabel(kind: GlobalSearchResultKind) {
  switch (kind) {
    case "song":
      return "Songs";
    case "clip":
      return "Clips";
    case "note":
      return "Notepad";
    case "collection":
      return "Collections";
    case "workspace":
    default:
      return "Workspaces";
  }
}

export function buildGlobalSearchResults(workspaces: Workspace[], notes: Note[], query: string) {
  const needle = normalizeNeedle(query);
  if (!needle) return [] as GlobalSearchResult[];

  const results: GlobalSearchResult[] = [];

  for (const workspace of workspaces) {
    const workspaceMatch = findBestFieldMatch(
      [
        { source: "title", text: workspace.title, baseScore: 108 },
        { source: "description", text: workspace.description ?? "", baseScore: 68 },
      ],
      needle
    );

    if (workspaceMatch) {
      results.push({
        id: `workspace:${workspace.id}`,
        kind: "workspace",
        title: workspace.title,
        context: workspace.description?.trim() || "Workspace",
        matchSource: workspaceMatch.source,
        snippet:
          workspaceMatch.source === "title" ? workspace.description?.trim() || null : workspaceMatch.snippet,
        score: workspaceMatch.score,
        updatedAt: Math.max(
          ...workspace.ideas.map((idea) => idea.lastActivityAt),
          ...workspace.collections.map((collection) => collection.updatedAt),
          0
        ),
        workspaceId: workspace.id,
      });
    }

    for (const collection of workspace.collections) {
      const collectionMatch = findBestFieldMatch(
        [{ source: "title", text: collection.title, baseScore: 102 }],
        needle
      );

      if (!collectionMatch) continue;

      results.push({
        id: `collection:${collection.id}`,
        kind: "collection",
        title: collection.title,
        context: buildCollectionParentPath(workspace, collection.id),
        matchSource: collectionMatch.source,
        snippet: null,
        score: collectionMatch.score,
        updatedAt: collection.updatedAt,
        workspaceId: workspace.id,
        collectionId: collection.id,
      });
    }

    for (const idea of workspace.ideas) {
      const ideaMatch = findBestFieldMatch(buildIdeaSearchFields(idea), needle);
      if (!ideaMatch) continue;

      results.push({
        id: `idea:${idea.id}`,
        kind: idea.kind === "project" ? "song" : "clip",
        title: idea.title,
        context: buildCollectionPath(workspace, idea.collectionId),
        matchSource: ideaMatch.source,
        snippet: ideaMatch.source === "title" ? null : ideaMatch.snippet,
        score: ideaMatch.score + (idea.kind === "project" ? 4 : 0),
        updatedAt: idea.lastActivityAt,
        workspaceId: workspace.id,
        collectionId: idea.collectionId,
        ideaId: idea.id,
      });
    }
  }

  for (const note of notes) {
    const hasExplicitTitle = note.title.trim().length > 0;
    const fullBody = note.body.trim();
    const title = deriveNotePreviewTitle(note);
    const body = deriveNotePreviewBody(note) ?? fullBody;
    const noteMatch = findBestFieldMatch(
      [
        {
          source: "title",
          text: title,
          baseScore: 114,
          snippetText: hasExplicitTitle ? body : fullBody,
        },
        { source: "body", text: body, baseScore: 86 },
      ],
      needle
    );

    if (!noteMatch) continue;

    results.push({
      id: `note:${note.id}`,
      kind: "note",
      title,
      context: note.isPinned ? "Notepad • Pinned" : "Notepad",
      matchSource: noteMatch.source,
      snippet: noteMatch.source === "title" && hasExplicitTitle ? body || null : noteMatch.snippet,
      score: noteMatch.score + (note.isPinned ? 3 : 0),
      updatedAt: note.updatedAt,
      noteId: note.id,
      isPinned: note.isPinned,
    });
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
    return a.title.localeCompare(b.title);
  });
}

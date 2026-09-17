/**
 * The label a pushed page's back button wears: the name of the place BACK
 * actually lands on. Derived from the route beneath the page on the root stack,
 * never from a parameter a call site could forget or get wrong — the label and
 * the action can't disagree (navigation law, 2026-09-16).
 */

export type OriginRoute = {
  /** Root-stack route name beneath the page (e.g. "Home", "Activity"). */
  name: string;
  /** Focused leaf of that route (e.g. "CollectionDetail" inside Home). */
  deepestName: string;
  params?: Record<string, unknown>;
};

type WorkspaceLike = {
  id: string;
  title: string;
  collections: Array<{ id: string; title: string }>;
  ideas: Array<{ id: string; title: string }>;
};

type Translate = (key: string) => string;

// Ids are uuids / timestamps, route names are identifiers: "|" never occurs.
const ORIGIN_KEY_SEPARATOR = "|";

/** Compact, comparable form for a `useNavigationState` selector (a primitive
 *  keeps the subscription from re-rendering on every state tick). */
export function encodeOriginRoute(origin: OriginRoute | null): string | null {
  if (!origin) return null;
  const params = origin.params ?? {};
  return [
    origin.name,
    origin.deepestName,
    typeof params.collectionId === "string" ? params.collectionId : "",
    typeof params.workspaceId === "string" ? params.workspaceId : "",
    typeof params.ideaId === "string" ? params.ideaId : "",
  ].join(ORIGIN_KEY_SEPARATOR);
}

export function decodeOriginRoute(key: string | null): OriginRoute | null {
  if (!key) return null;
  const [name, deepestName, collectionId, workspaceId, ideaId] = key.split(ORIGIN_KEY_SEPARATOR);
  if (!name || !deepestName) return null;
  return {
    name,
    deepestName,
    params: {
      ...(collectionId ? { collectionId } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(ideaId ? { ideaId } : {}),
    },
  };
}

export function resolveOriginLabel(
  origin: OriginRoute | null,
  context: { workspaces: WorkspaceLike[]; activeWorkspaceId: string | null; t: Translate }
): string | null {
  if (!origin) return null;
  const { workspaces, activeWorkspaceId, t } = context;
  const params = origin.params ?? {};
  const workspaceId = typeof params.workspaceId === "string" ? params.workspaceId : null;
  const collectionId = typeof params.collectionId === "string" ? params.collectionId : null;
  const ideaId = typeof params.ideaId === "string" ? params.ideaId : null;

  const findCollectionTitle = () => {
    if (!collectionId) return null;
    const preferred = workspaceId ? workspaces.find((ws) => ws.id === workspaceId) : null;
    const candidates = preferred ? [preferred, ...workspaces] : workspaces;
    for (const ws of candidates) {
      const collection = ws.collections.find((c) => c.id === collectionId);
      if (collection) return collection.title;
    }
    return null;
  };

  switch (origin.deepestName) {
    case "Workspaces":
      return t("navigation.workspaces");
    case "Browse": {
      const workspace =
        workspaces.find((ws) => ws.id === (workspaceId ?? activeWorkspaceId ?? "")) ?? null;
      return workspace?.title ?? t("navigation.workspace");
    }
    case "CollectionDetail":
    case "CollectionVisit":
      return findCollectionTitle();
    case "SearchHome":
      return t("search.title");
    case "RevisitHome":
      return t("navigation.revisit");
    case "ShelfHome":
      return t("navigation.shelf");
    case "ReceivedHome":
    case "TransferReceive":
    case "ShareImport":
      return t("navigation.received");
    case "ActivityHome":
    case "Activity":
      return t("navigation.activity");
    case "LibraryHome":
      return t("navigation.compilations");
    case "SettingsHome":
      return t("navigation.settings");
    case "NotepadHome":
      return t("navigation.lyricsPad");
    case "SparkHome":
    case "WordLadderHome":
    case "CutUpHome":
    case "MagpieHome":
      return t("navigation.sparks");
    case "TunerHome":
      return t("navigation.tuner");
    case "MetronomeHome":
      return t("navigation.metronome");
    case "IdeaDetail": {
      if (!ideaId) return null;
      for (const ws of workspaces) {
        const idea = ws.ideas.find((candidate) => candidate.id === ideaId);
        if (idea) return idea.title;
      }
      return null;
    }
    case "SongbookReader":
      return t("library.songbook");
    case "SetlistSong":
      return t("library.setlists");
    default:
      return null;
  }
}

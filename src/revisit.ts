import { getActivityEventsWithHistory, startOfActivityDay } from "./activity";
import { getIdeaCreatedAt, getIdeaUpdatedAt } from "./ideaSort";
import type { ActivityEvent, ClipVersion, SongIdea, Workspace } from "./types";
import { getCollectionAncestors, getCollectionById, getCollectionScopeIds } from "./utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RevisitSectionKey = "pickup" | "forgotten" | "vault" | "around";

export type RevisitCandidate = {
  key: string;
  ideaId: string;
  workspaceId: string;
  workspaceTitle: string;
  collectionId: string;
  collectionTitle: string;
  collectionPathLabel: string;
  title: string;
  itemKind: "project" | "clip";
  primaryClip: ClipVersion;
  createdAt: number;
  updatedAt: number;
  ageDays: number;
  sessionsCount: number;
  updateEventCount: number;
  variationCount: number;
  lyricsVersionCount: number;
  hasNotes: boolean;
  hasLyrics: boolean;
  wasRenamed: boolean;
  completionPct: number;
  pickupScore: number;
  forgottenScore: number;
  vaultScore: number;
};

export type RevisitSectionItem = {
  candidate: RevisitCandidate;
  reason: string;
};

export type RevisitSection = {
  key: RevisitSectionKey;
  title: string;
  subtitle: string;
  items: RevisitSectionItem[];
  emptyTitle: string;
  emptySubtitle: string;
};

export type RevisitSourceOption = {
  id: string;
  label: string;
  count: number;
  included: boolean;
  workspaceId?: string;
  depth?: number;
};

type BuildRevisitModelArgs = {
  workspaces: Workspace[];
  activityEvents: ActivityEvent[];
  excludedWorkspaceIds: string[];
  excludedCollectionIds: string[];
  hiddenCandidateIds: string[];
  snoozedUntilById: Record<string, number>;
  vaultExposureCountById: Record<string, number>;
  vaultLastSeenAtById: Record<string, number>;
  now?: number;
};

export type RevisitModel = {
  totalEligibleCount: number;
  workspaceOptions: RevisitSourceOption[];
  collectionOptions: RevisitSourceOption[];
  sections: RevisitSection[];
};

function buildCandidateKey(workspaceId: string, ideaId: string) {
  return `${workspaceId}:${ideaId}`;
}

function looksLikeDefaultTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return true;

  return (
    /^\d{1,2}:\d{2} [AP]M \d{2}\/\d{2}\/\d{4}( v\d+)?$/i.test(trimmed) ||
    /^new clip [—-] \d{2}\/\d{2}\/\d{4},? .+$/i.test(trimmed)
  );
}

function hashFraction(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function formatRelativeAge(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) {
    const weeks = Math.max(2, Math.round(days / 7));
    return `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.max(2, Math.round(days / 30));
    return `${months} months ago`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatDormancyDuration(days: number) {
  if (days <= 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) {
    const weeks = Math.max(2, Math.round(days / 7));
    return `${weeks} weeks`;
  }
  if (days < 365) {
    const months = Math.max(2, Math.round(days / 30));
    return `${months} months`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return `${years} year${years === 1 ? "" : "s"}`;
}

export function formatLastTouchedLabel(updatedAt: number, now = Date.now()) {
  const ageDays = Math.max(0, Math.floor((now - updatedAt) / DAY_MS));
  return `Last touched ${formatRelativeAge(ageDays)}`;
}

function formatSeasonLabel(ts: number) {
  const date = new Date(ts);
  const month = date.getMonth();
  const year = date.getFullYear();
  const season =
    month <= 1 || month === 11
      ? "winter"
      : month <= 4
        ? "spring"
        : month <= 7
          ? "summer"
          : "fall";
  return `${season} ${year}`;
}

function buildCollectionPathLabel(workspace: Workspace, collectionId: string) {
  const collection = getCollectionById(workspace, collectionId);
  if (!collection) return "Unknown collection";
  const ancestors = getCollectionAncestors(workspace, collectionId);
  return [...ancestors.map((item) => item.title), collection.title].join(" / ");
}

function buildEventsByIdea(
  workspaces: Workspace[],
  activityEvents: ActivityEvent[]
) {
  const eventsByIdea = new Map<string, ActivityEvent[]>();
  const allEvents = getActivityEventsWithHistory(workspaces, activityEvents);

  for (const event of allEvents) {
    const key = buildCandidateKey(event.workspaceId, event.ideaId);
    const list = eventsByIdea.get(key);
    if (list) {
      list.push(event);
      continue;
    }
    eventsByIdea.set(key, [event]);
  }

  return eventsByIdea;
}

function isIdeaHiddenByExistingState(workspace: Workspace, idea: SongIdea) {
  const collection = getCollectionById(workspace, idea.collectionId);
  const createdDayTs = startOfActivityDay(getIdeaCreatedAt(idea));
  const updatedDayTs = startOfActivityDay(getIdeaUpdatedAt(idea));
  const hiddenKeys = new Set<string>();

  for (const hiddenDay of workspace.ideasListState?.hiddenDays ?? []) {
    hiddenKeys.add(`${hiddenDay.metric}:${hiddenDay.dayStartTs}`);
  }
  for (const hiddenDay of collection?.ideasListState.hiddenDays ?? []) {
    hiddenKeys.add(`${hiddenDay.metric}:${hiddenDay.dayStartTs}`);
  }

  const hiddenIdeaIds = new Set([
    ...(workspace.ideasListState?.hiddenIdeaIds ?? []),
    ...(collection?.ideasListState.hiddenIdeaIds ?? []),
  ]);

  return (
    hiddenIdeaIds.has(idea.id) ||
    hiddenKeys.has(`created:${createdDayTs}`) ||
    hiddenKeys.has(`updated:${updatedDayTs}`)
  );
}

function isCollectionExcluded(
  workspace: Workspace,
  collectionId: string,
  excludedCollectionIds: Set<string>
) {
  if (excludedCollectionIds.has(collectionId)) return true;
  return getCollectionAncestors(workspace, collectionId).some((item) =>
    excludedCollectionIds.has(item.id)
  );
}

function getPrimaryClip(idea: SongIdea) {
  return idea.clips.find((clip) => clip.isPrimary) ?? idea.clips[0] ?? null;
}

function computePickupScore(candidate: Omit<RevisitCandidate, "pickupScore" | "forgottenScore" | "vaultScore">) {
  let score = Math.min(candidate.ageDays, 180) * 0.46;
  score += Math.min(candidate.sessionsCount, 5) * 12;
  score += Math.min(candidate.updateEventCount, 6) * 4;
  score += Math.min(candidate.variationCount, 4) * 8;
  score += Math.min(candidate.lyricsVersionCount, 3) * 6;
  score += candidate.hasNotes ? 12 : 0;
  score += candidate.wasRenamed ? 8 : -4;
  score += candidate.itemKind === "project" ? 10 : 0;

  if (candidate.completionPct > 0 && candidate.completionPct < 100) {
    score += 12 - Math.min(Math.abs(candidate.completionPct - 55) * 0.18, 8);
  }

  if (candidate.ageDays < 7) {
    score -= 38;
  }

  return score;
}

function computeForgottenScore(candidate: Omit<RevisitCandidate, "pickupScore" | "forgottenScore" | "vaultScore">) {
  let score = Math.min(candidate.ageDays, 365) * 0.4;
  score += candidate.itemKind === "clip" ? 12 : -120;
  score += candidate.sessionsCount <= 2 ? 14 : 0;
  score += candidate.variationCount === 0 ? 10 : 0;
  score += candidate.wasRenamed ? 8 : 0;
  score += candidate.hasNotes ? 6 : 0;

  if (candidate.ageDays < 21) {
    score -= 40;
  }

  return score;
}

function computeVaultScore(
  candidate: Omit<RevisitCandidate, "pickupScore" | "forgottenScore" | "vaultScore">,
  rotationKey: string,
  exposureCount: number,
  lastSeenAt: number | undefined,
  now: number
) {
  const randomScore = hashFraction(`${candidate.key}:${rotationKey}`) * 72;
  const ageBoost = Math.min(candidate.ageDays, 720) * 0.08;
  const underexposedBoost = candidate.sessionsCount <= 1 ? 8 : 0;
  const recentPenalty =
    typeof lastSeenAt === "number" && now - lastSeenAt < 21 * DAY_MS ? 28 : 0;
  const exposurePenalty = exposureCount * 11;
  return randomScore + ageBoost + underexposedBoost - recentPenalty - exposurePenalty;
}

function buildPickupReason(candidate: RevisitCandidate, now: number) {
  if (candidate.sessionsCount >= 3) {
    return `Worked on across ${candidate.sessionsCount} sessions`;
  }
  if (candidate.variationCount >= 2) {
    return `${candidate.variationCount} variations explored`;
  }
  if (candidate.hasLyrics) {
    return "Lyrics were taking shape";
  }
  if (candidate.hasNotes) {
    return "Notes are waiting here";
  }
  return `Not touched in ${formatDormancyDuration(
    Math.max(0, Math.floor((now - candidate.updatedAt) / DAY_MS))
  )}`;
}

function buildForgottenReason(candidate: RevisitCandidate) {
  if (candidate.sessionsCount <= 1 && candidate.variationCount === 0) {
    return "Never organized";
  }
  if (!candidate.hasNotes) {
    return "Forgotten seed";
  }
  return "Worth another listen";
}

function buildVaultReason(candidate: RevisitCandidate) {
  if (candidate.ageDays >= 330) {
    return `From ${formatSeasonLabel(candidate.createdAt)}`;
  }
  return "From the vault";
}

function getAnniversaryDistanceDays(ts: number, now: number) {
  const date = new Date(ts);
  const nowDate = new Date(now);
  const nowDayTs = startOfActivityDay(now);
  const anniversaryTimestamps = [
    new Date(nowDate.getFullYear() - 1, date.getMonth(), date.getDate()).getTime(),
    new Date(nowDate.getFullYear(), date.getMonth(), date.getDate()).getTime(),
    new Date(nowDate.getFullYear() + 1, date.getMonth(), date.getDate()).getTime(),
  ];

  return Math.min(
    ...anniversaryTimestamps.map((candidateTs) =>
      Math.round(Math.abs(startOfActivityDay(candidateTs) - nowDayTs) / DAY_MS)
    )
  );
}

function computeAroundThisTimeScore(candidate: RevisitCandidate, now: number) {
  const distanceDays = getAnniversaryDistanceDays(candidate.createdAt, now);
  let score = Math.max(0, 45 - distanceDays) * 2.1;
  score += Math.min(candidate.ageDays, 720) * 0.05;
  score += Math.min(candidate.sessionsCount, 4) * 2.5;
  score += candidate.hasNotes ? 6 : 0;
  score += candidate.hasLyrics ? 5 : 0;

  if (distanceDays <= 3) {
    score += 14;
  }

  if (candidate.ageDays < 60) {
    score -= 40;
  }

  return score;
}

function buildAroundThisTimeReason(candidate: RevisitCandidate, now: number) {
  const createdAt = new Date(candidate.createdAt);
  const nowDate = new Date(now);
  const distanceDays = getAnniversaryDistanceDays(candidate.createdAt, now);
  const yearsAgo = nowDate.getFullYear() - createdAt.getFullYear();

  if (distanceDays <= 7 && yearsAgo >= 1) {
    return yearsAgo === 1
      ? "Made around this time last year"
      : `Made around this time in ${createdAt.getFullYear()}`;
  }

  return `From ${formatSeasonLabel(candidate.createdAt)}`;
}

function compareByScore(
  a: RevisitCandidate,
  b: RevisitCandidate,
  scoreKey: "pickupScore" | "forgottenScore" | "vaultScore"
) {
  return (
    b[scoreKey] - a[scoreKey] ||
    b.ageDays - a.ageDays ||
    a.title.localeCompare(b.title) ||
    a.key.localeCompare(b.key)
  );
}

function pickVaultItems(candidates: RevisitCandidate[], maxItems: number) {
  const picked: RevisitCandidate[] = [];
  const seenKinds = new Set<string>();
  const seenWorkspaces = new Set<string>();

  const passes = [
    (candidate: RevisitCandidate) =>
      !seenKinds.has(candidate.itemKind) && !seenWorkspaces.has(candidate.workspaceId),
    (candidate: RevisitCandidate) => !seenWorkspaces.has(candidate.workspaceId),
    () => true,
  ];

  for (const shouldInclude of passes) {
    for (const candidate of candidates) {
      if (picked.length >= maxItems) {
        return picked;
      }
      if (picked.some((item) => item.key === candidate.key)) continue;
      if (!shouldInclude(candidate)) continue;
      picked.push(candidate);
      seenKinds.add(candidate.itemKind);
      seenWorkspaces.add(candidate.workspaceId);
    }
  }

  return picked;
}

export function buildRevisitModel({
  workspaces,
  activityEvents,
  excludedWorkspaceIds,
  excludedCollectionIds,
  hiddenCandidateIds,
  snoozedUntilById,
  vaultExposureCountById,
  vaultLastSeenAtById,
  now = Date.now(),
}: BuildRevisitModelArgs): RevisitModel {
  const activeWorkspaces = workspaces.filter((workspace) => !workspace.isArchived);
  const excludedWorkspaceIdSet = new Set(excludedWorkspaceIds);
  const excludedCollectionIdSet = new Set(excludedCollectionIds);
  const hiddenCandidateIdSet = new Set(hiddenCandidateIds);
  const eventsByIdea = buildEventsByIdea(activeWorkspaces, activityEvents);
  const rotationKey = new Date(now).toISOString().slice(0, 10);

  const workspaceOptions: RevisitSourceOption[] = activeWorkspaces
    .map((workspace) => {
      const count = workspace.ideas.filter((idea) => {
        const primaryClip = getPrimaryClip(idea);
        return !!primaryClip?.audioUri && !isIdeaHiddenByExistingState(workspace, idea);
      }).length;

      return {
        id: workspace.id,
        label: workspace.title,
        count,
        included: !excludedWorkspaceIdSet.has(workspace.id),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const collectionOptions: RevisitSourceOption[] = activeWorkspaces
    .flatMap((workspace) =>
      workspace.collections.map((collection) => {
        const scopeIds = getCollectionScopeIds(workspace, collection.id);
        const count = workspace.ideas.filter((idea) => {
          const primaryClip = getPrimaryClip(idea);
          return (
            scopeIds.has(idea.collectionId) &&
            !!primaryClip?.audioUri &&
            !isIdeaHiddenByExistingState(workspace, idea)
          );
        }).length;

        return {
          id: collection.id,
          workspaceId: workspace.id,
          label: `${workspace.title} • ${buildCollectionPathLabel(workspace, collection.id)}`,
          count,
          depth: getCollectionAncestors(workspace, collection.id).length,
          included:
            !excludedWorkspaceIdSet.has(workspace.id) &&
            !isCollectionExcluded(workspace, collection.id, excludedCollectionIdSet),
        };
      })
    )
    .sort((a, b) => a.label.localeCompare(b.label));

  const allCandidates: RevisitCandidate[] = [];

  for (const workspace of activeWorkspaces) {
    if (excludedWorkspaceIdSet.has(workspace.id)) continue;

    for (const idea of workspace.ideas) {
      const primaryClip = getPrimaryClip(idea);
      if (!primaryClip?.audioUri) continue;
      if (isIdeaHiddenByExistingState(workspace, idea)) continue;
      if (isCollectionExcluded(workspace, idea.collectionId, excludedCollectionIdSet)) continue;

      const key = buildCandidateKey(workspace.id, idea.id);
      if (hiddenCandidateIdSet.has(key)) continue;

      const snoozedUntil = snoozedUntilById[key];
      if (typeof snoozedUntil === "number" && snoozedUntil > now) continue;

      const collection = getCollectionById(workspace, idea.collectionId);
      if (!collection) continue;

      const createdAt = getIdeaCreatedAt(idea);
      const updatedAt = getIdeaUpdatedAt(idea);
      const ageDays = Math.max(0, Math.floor((now - updatedAt) / DAY_MS));
      const ideaEvents = eventsByIdea.get(key) ?? [];
      const sessionsCount = new Set(
        ideaEvents.map((event) => startOfActivityDay(event.at))
      ).size;
      const updateEventCount = ideaEvents.filter((event) => event.metric === "updated").length;
      const variationCount = Math.max(0, idea.clips.length - 1);
      const lyricsVersionCount = idea.kind === "project" ? idea.lyrics?.versions.length ?? 0 : 0;
      const hasNotes =
        idea.notes.trim().length > 0 || primaryClip.notes.trim().length > 0;
      const hasLyrics = lyricsVersionCount > 0;
      const wasRenamed = !looksLikeDefaultTitle(idea.title);

      const candidateBase = {
        key,
        ideaId: idea.id,
        workspaceId: workspace.id,
        workspaceTitle: workspace.title,
        collectionId: collection.id,
        collectionTitle: collection.title,
        collectionPathLabel: buildCollectionPathLabel(workspace, collection.id),
        title: idea.title,
        itemKind: idea.kind,
        primaryClip,
        createdAt,
        updatedAt,
        ageDays,
        sessionsCount,
        updateEventCount,
        variationCount,
        lyricsVersionCount,
        hasNotes,
        hasLyrics,
        wasRenamed,
        completionPct: idea.completionPct,
      } satisfies Omit<
        RevisitCandidate,
        "pickupScore" | "forgottenScore" | "vaultScore"
      >;

      allCandidates.push({
        ...candidateBase,
        pickupScore: computePickupScore(candidateBase),
        forgottenScore: computeForgottenScore(candidateBase),
        vaultScore: computeVaultScore(
          candidateBase,
          rotationKey,
          vaultExposureCountById[key] ?? 0,
          vaultLastSeenAtById[key],
          now
        ),
      });
    }
  }

  const pickupPool = allCandidates
    .filter(
      (candidate) =>
        candidate.ageDays >= 7 &&
        (
          candidate.sessionsCount >= 2 ||
          candidate.variationCount >= 1 ||
          candidate.hasNotes ||
          candidate.hasLyrics ||
          candidate.wasRenamed
        )
    )
    .sort((a, b) => compareByScore(a, b, "pickupScore"));
  const pickupItems = pickupPool.slice(0, 6).map((candidate) => ({
    candidate,
    reason: buildPickupReason(candidate, now),
  }));

  const takenKeys = new Set(pickupItems.map((item) => item.candidate.key));

  const forgottenPool = allCandidates
    .filter(
      (candidate) =>
        !takenKeys.has(candidate.key) &&
        candidate.itemKind === "clip" &&
        candidate.ageDays >= 21
    )
    .sort((a, b) => compareByScore(a, b, "forgottenScore"));
  const forgottenItems = forgottenPool.slice(0, 6).map((candidate) => ({
    candidate,
    reason: buildForgottenReason(candidate),
  }));

  for (const item of forgottenItems) {
    takenKeys.add(item.candidate.key);
  }

  const vaultPool = allCandidates
    .filter(
      (candidate) =>
        !takenKeys.has(candidate.key) &&
        candidate.ageDays >= 45
    )
    .sort((a, b) => compareByScore(a, b, "vaultScore"));
  const vaultItems = pickVaultItems(vaultPool, 3).map((candidate) => ({
    candidate,
    reason: buildVaultReason(candidate),
  }));

  for (const item of vaultItems) {
    takenKeys.add(item.candidate.key);
  }

  const aroundMatcher = (candidate: RevisitCandidate) =>
    candidate.ageDays >= 60 && getAnniversaryDistanceDays(candidate.createdAt, now) <= 45;

  const buildAroundItems = (pool: RevisitCandidate[]) =>
    pool
      .filter(aroundMatcher)
      .map((candidate) => ({
        candidate,
        score: computeAroundThisTimeScore(candidate, now),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.candidate.title.localeCompare(b.candidate.title) ||
          a.candidate.key.localeCompare(b.candidate.key)
      )
      .slice(0, 4)
      .map(({ candidate }) => ({
        candidate,
        reason: buildAroundThisTimeReason(candidate, now),
      }));

  const aroundItems = (() => {
    const primaryPool = allCandidates.filter((candidate) => !takenKeys.has(candidate.key));
    const primaryItems = buildAroundItems(primaryPool);
    if (primaryItems.length > 0) return primaryItems;
    return buildAroundItems(allCandidates);
  })();

  return {
    totalEligibleCount: allCandidates.length,
    workspaceOptions,
    collectionOptions,
    sections: [
      {
        key: "pickup",
        title: "Pick up where you left off",
        subtitle:
          "Dormant songs, sketches, and clips that already show signs of momentum.",
        items: pickupItems,
        emptyTitle: "Nothing is asking for a restart right now",
        emptySubtitle:
          "Recent work and filters are keeping this section quiet for the moment.",
      },
      {
        key: "forgotten",
        title: "Forgotten seeds",
        subtitle:
          "Older standalone clips that still make good prompts when you want a fresh spark.",
        items: forgottenItems,
        emptyTitle: "No seeds are waiting in the wings",
        emptySubtitle:
          "Older standalone clips will show up here once they have had some time to breathe.",
      },
      {
        key: "vault",
        title: "From the vault",
        subtitle:
          "A deliberately small dose of older material chosen for serendipity, not noise.",
        items: vaultItems,
        emptyTitle: "The vault is staying quiet today",
        emptySubtitle:
          "When enough older material builds up, this section will rotate in 1 to 3 surprise picks.",
      },
      {
        key: "around",
        title: "Around this time",
        subtitle:
          "Ideas from the same season or calendar stretch in earlier years, resurfaced gently.",
        items: aroundItems,
        emptyTitle: "Nothing seasonal is lining up just yet",
        emptySubtitle:
          "As older material spans more months and years, this section will start bringing back timely rediscoveries.",
      },
    ],
  };
}

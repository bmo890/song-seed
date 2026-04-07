import { getActivityEventsWithHistory, startOfActivityDay } from "./activity";
import { getIdeaCreatedAt, getIdeaUpdatedAt } from "./ideaSort";
import type { ActivityEvent, ClipVersion, SongIdea, Workspace } from "./types";
import { getCollectionAncestors, getCollectionById, getCollectionScopeIds } from "./utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const AROUND_THIS_TIME_WINDOW_DAYS = 30;
const AROUND_THIS_TIME_SNAPSHOT_LIMIT = 10;

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
  archiveAgeDays: number;
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
  totalCount?: number;
  actionLabel?: string;
  emptyTitle: string;
  emptySubtitle: string;
};

export type RevisitAroundSnapshot = {
  title: string;
  subtitle: string;
  windowLabel: string;
  year: number;
  startTs: number;
  endTs: number;
  items: RevisitSectionItem[];
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
  aroundSnapshot: RevisitAroundSnapshot;
};

type RevisitThresholds = {
  pickupMinAgeDays: number;
  forgottenMinAgeDays: number;
  vaultMinAgeDays: number;
  aroundMinAgeDays: number;
};

function buildCandidateKey(workspaceId: string, ideaId: string) {
  return `${workspaceId}:${ideaId}`;
}

function looksLikeDefaultTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return true;

  return (
    /^\d{1,2}:\d{2} [AP]M \d{2}\/\d{2}\/\d{4}( v\d+)?$/i.test(trimmed) ||
    /^new clip [—-] \d{2}\/\d{2}\/\d{4},? .+$/i.test(trimmed) ||
    /^\d{1,2}:\d{2}[AP]M [A-Z][a-z]{2} \d{1,2}(st|nd|rd|th)( \(\d+\))?$/i.test(trimmed) ||
    /^import \d{1,2}:\d{2}[AP]M [A-Z][a-z]{2} \d{1,2}(st|nd|rd|th)( \(\d+\))?$/i.test(trimmed) ||
    /^imported clip [—-] .+$/i.test(trimmed)
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

function pickDailySubsetCount(sectionKey: RevisitSectionKey, poolSize: number, rotationKey: string) {
  if (poolSize <= 0) return 0;
  if (sectionKey === "around") return 1;

  const range =
    sectionKey === "vault"
      ? { min: 2, max: 4 }
      : { min: 2, max: 5 };

  const min = Math.min(range.min, poolSize);
  const max = Math.min(range.max, poolSize);
  if (min >= max) return min;

  const spread = max - min + 1;
  return min + Math.floor(hashFraction(`${sectionKey}:count:${rotationKey}:${poolSize}`) * spread);
}

function shuffleCandidatesDaily<T extends { key: string }>(
  items: T[],
  sectionKey: RevisitSectionKey,
  rotationKey: string
) {
  if (items.length <= 1) return items;

  return [...items].sort((a, b) => {
    const aRank = hashFraction(`${sectionKey}:${rotationKey}:${a.key}`);
    const bRank = hashFraction(`${sectionKey}:${rotationKey}:${b.key}`);
    return aRank - bRank || a.key.localeCompare(b.key);
  });
}

function buildDailyCandidateWindow(
  candidates: RevisitCandidate[],
  sectionKey: RevisitSectionKey,
  rotationKey: string
) {
  if (candidates.length === 0) return candidates;

  const visibleCount = pickDailySubsetCount(sectionKey, candidates.length, rotationKey);
  const windowSize = Math.min(
    candidates.length,
    Math.max(visibleCount + 2, visibleCount * 2)
  );
  const candidateWindow = candidates.slice(0, windowSize);
  return shuffleCandidatesDaily(candidateWindow, sectionKey, rotationKey).slice(0, visibleCount);
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

function formatMonthDayLabel(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(ts));
}

function formatAroundSnapshotWindowLabel(now: number) {
  const nowDate = new Date(now);
  const center = new Date(nowDate.getFullYear() - 1, nowDate.getMonth(), nowDate.getDate()).getTime();
  const start = center - AROUND_THIS_TIME_WINDOW_DAYS * DAY_MS;
  const end = center + AROUND_THIS_TIME_WINDOW_DAYS * DAY_MS;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  if (sameYear) {
    return `${formatMonthDayLabel(start)} – ${formatMonthDayLabel(end)}, ${endDate.getFullYear()}`;
  }

  return `${formatMonthDayLabel(start)}, ${startDate.getFullYear()} – ${formatMonthDayLabel(end)}, ${endDate.getFullYear()}`;
}

function buildAroundSnapshotWindow(now: number) {
  const nowDate = new Date(now);
  const center = new Date(
    nowDate.getFullYear() - 1,
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const startTs = startOfActivityDay(center - AROUND_THIS_TIME_WINDOW_DAYS * DAY_MS);
  const endTs = startOfActivityDay(center + AROUND_THIS_TIME_WINDOW_DAYS * DAY_MS);

  return {
    year: new Date(center).getFullYear(),
    startTs,
    endTs,
  };
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
  let score = Math.min(candidate.archiveAgeDays, 365) * 0.4;
  score += candidate.itemKind === "clip" ? 12 : -120;
  score += candidate.sessionsCount <= 2 ? 14 : 0;
  score += candidate.variationCount === 0 ? 10 : 0;
  score += candidate.wasRenamed ? 8 : 0;
  score += candidate.hasNotes ? 6 : 0;

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
  const ageBoost = Math.min(candidate.archiveAgeDays, 720) * 0.08;
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
    return "Loose seed";
  }
  if (!candidate.hasNotes) {
    return "Raw idea";
  }
  return "Worth another listen";
}

function buildVaultReason(candidate: RevisitCandidate) {
  if (candidate.archiveAgeDays >= 330) {
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
  score += Math.min(candidate.archiveAgeDays, 720) * 0.05;
  score += Math.min(candidate.sessionsCount, 4) * 2.5;
  score += candidate.hasNotes ? 6 : 0;
  score += candidate.hasLyrics ? 5 : 0;

  if (distanceDays <= 3) {
    score += 14;
  }

  if (candidate.archiveAgeDays < 330) {
    score -= 40;
  }

  return score;
}

function buildAroundThisTimeReason(candidate: RevisitCandidate, now: number) {
  const createdAt = new Date(candidate.createdAt);
  const nowDate = new Date(now);
  const distanceDays = getAnniversaryDistanceDays(candidate.createdAt, now);
  const yearsAgo = nowDate.getFullYear() - createdAt.getFullYear();

  if (distanceDays <= AROUND_THIS_TIME_WINDOW_DAYS && yearsAgo >= 1) {
    return yearsAgo === 1
      ? "From around this time last year"
      : `Made around this time in ${createdAt.getFullYear()}`;
  }

  return `From ${formatSeasonLabel(candidate.createdAt)}`;
}

function compareByScore(
  a: RevisitCandidate,
  b: RevisitCandidate,
  scoreKey: "pickupScore" | "forgottenScore" | "vaultScore"
) {
  const secondaryAgeKey =
    scoreKey === "pickupScore" ? "ageDays" : "archiveAgeDays";

  return (
    b[scoreKey] - a[scoreKey] ||
    b[secondaryAgeKey] - a[secondaryAgeKey] ||
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

function getRevisitThresholds(): RevisitThresholds {
  return {
    pickupMinAgeDays: 10,
    forgottenMinAgeDays: 21,
    vaultMinAgeDays: 45,
    aroundMinAgeDays: 330,
  };
}

function applyStandardAgeBias(
  candidates: RevisitCandidate[],
  scoreKey: "pickupScore" | "forgottenScore" | "vaultScore"
) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      [scoreKey]:
        candidate[scoreKey] +
        Math.min(
          scoreKey === "pickupScore" ? candidate.ageDays : candidate.archiveAgeDays,
          scoreKey === "pickupScore" ? 240 : 365
        ) * (scoreKey === "pickupScore" ? 0.1 : 0.18),
    }))
    .sort((a, b) => compareByScore(a, b, scoreKey));
}

function isForgottenCandidate(
  candidate: RevisitCandidate,
  forgottenMinAgeDays: number
) {
  return (
    candidate.itemKind === "clip" &&
    candidate.archiveAgeDays >= forgottenMinAgeDays &&
    candidate.sessionsCount <= 3 &&
    candidate.variationCount <= 1 &&
    !candidate.hasLyrics &&
    candidate.completionPct < 60
  );
}

function getVaultDevelopmentSignals(candidate: RevisitCandidate) {
  let count = 0;
  if (candidate.itemKind === "project") count += 1;
  if (candidate.sessionsCount >= 3) count += 1;
  if (candidate.variationCount >= 1) count += 1;
  if (candidate.hasNotes) count += 1;
  if (candidate.hasLyrics) count += 1;
  if (candidate.wasRenamed) count += 1;
  if (candidate.completionPct >= 60) count += 1;
  return count;
}

function isVaultCandidate(
  candidate: RevisitCandidate,
  vaultMinAgeDays: number
) {
  return (
    candidate.archiveAgeDays >= vaultMinAgeDays &&
    getVaultDevelopmentSignals(candidate) >= 1
  );
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
  const thresholds = getRevisitThresholds();

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
      const archiveAgeDays = Math.max(0, Math.floor((now - createdAt) / DAY_MS));
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
        archiveAgeDays,
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

  const pickupPoolBase = allCandidates
    .filter(
      (candidate) =>
        candidate.ageDays >= thresholds.pickupMinAgeDays &&
        (candidate.itemKind === "project"
          ? (
              candidate.sessionsCount >= 1 ||
              candidate.variationCount >= 1 ||
              candidate.hasNotes ||
              candidate.hasLyrics ||
              candidate.wasRenamed ||
              candidate.completionPct >= 10
            )
          : (
              candidate.sessionsCount >= 2 ||
              candidate.updateEventCount >= 2 ||
              candidate.variationCount >= 1 ||
              candidate.hasNotes ||
              (candidate.wasRenamed && candidate.updateEventCount >= 1) ||
              candidate.completionPct >= 25
            ))
    )
    .sort((a, b) => compareByScore(a, b, "pickupScore"));
  const pickupPool = applyStandardAgeBias(pickupPoolBase, "pickupScore");
  const pickupItems = buildDailyCandidateWindow(
    pickupPool,
    "pickup",
    rotationKey
  )
    .map((candidate) => ({
    candidate,
    reason: buildPickupReason(candidate, now),
  }));

  const takenKeys = new Set(pickupItems.map((item) => item.candidate.key));

  const forgottenPoolBase = allCandidates
    .filter(
      (candidate) =>
        !takenKeys.has(candidate.key) &&
        isForgottenCandidate(candidate, thresholds.forgottenMinAgeDays)
    )
    .sort((a, b) => compareByScore(a, b, "forgottenScore"));
  const forgottenPool = applyStandardAgeBias(forgottenPoolBase, "forgottenScore");
  const forgottenItems = buildDailyCandidateWindow(
    forgottenPool,
    "forgotten",
    rotationKey
  )
    .map((candidate) => ({
    candidate,
    reason: buildForgottenReason(candidate),
  }));

  for (const item of forgottenItems) {
    takenKeys.add(item.candidate.key);
  }

  const vaultPoolBase = allCandidates
    .filter(
      (candidate) =>
        !takenKeys.has(candidate.key) &&
        isVaultCandidate(candidate, thresholds.vaultMinAgeDays)
    )
    .sort((a, b) => compareByScore(a, b, "vaultScore"));
  const vaultPool = applyStandardAgeBias(vaultPoolBase, "vaultScore");
  const vaultWindow = buildDailyCandidateWindow(vaultPool, "vault", rotationKey);
  const vaultItems = pickVaultItems(vaultWindow, vaultWindow.length).map((candidate) => ({
    candidate,
    reason: buildVaultReason(candidate),
  }));

  for (const item of vaultItems) {
    takenKeys.add(item.candidate.key);
  }

  const aroundMatcher = (candidate: RevisitCandidate) =>
    candidate.archiveAgeDays >= thresholds.aroundMinAgeDays &&
    getAnniversaryDistanceDays(candidate.createdAt, now) <= AROUND_THIS_TIME_WINDOW_DAYS;

  const buildAroundItems = (pool: RevisitCandidate[], limit: number) =>
    shuffleCandidatesDaily(
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
      .map(({ candidate }) => candidate),
      "around",
      rotationKey
    )
      .slice(0, limit)
      .map((candidate) => ({
        candidate,
        reason: buildAroundThisTimeReason(candidate, now),
      }));

  const aroundSnapshotItems = buildAroundItems(allCandidates, AROUND_THIS_TIME_SNAPSHOT_LIMIT);
  const aroundSnapshotWindow = buildAroundSnapshotWindow(now);
  const aroundItems = (() => {
    const primaryPool = allCandidates.filter((candidate) => !takenKeys.has(candidate.key));
    const primaryItems = buildAroundItems(primaryPool, 1);
    if (primaryItems.length > 0) return primaryItems;
    return buildAroundItems(allCandidates, 1);
  })();
  const eligibleCandidateCount = new Set([
    ...pickupPoolBase.map((candidate) => candidate.key),
    ...forgottenPoolBase.map((candidate) => candidate.key),
    ...vaultPoolBase.map((candidate) => candidate.key),
    ...aroundSnapshotItems.map((item) => item.candidate.key),
  ]).size;

  return {
    totalEligibleCount: eligibleCandidateCount,
    workspaceOptions,
    collectionOptions,
    sections: [
      {
        key: "pickup",
        title: "Pick Up",
        subtitle: "Things that had some momentum and feel worth resuming.",
        items: pickupItems,
        emptyTitle: "No stalled work with momentum right now",
        emptySubtitle: "Check back later.",
      },
      {
        key: "forgotten",
        title: "Forgotten",
        subtitle: "Older loose clips and seeds that were left behind.",
        items: forgottenItems,
        emptyTitle: "No older clips yet",
        emptySubtitle: "Older clips will surface here.",
      },
      {
        key: "vault",
        title: "Vault",
        subtitle: "Older material with some shape or history that fell out of rotation.",
        items: vaultItems,
        emptyTitle: "Vault is quiet today",
        emptySubtitle: "More older material will surface later.",
      },
      {
        key: "around",
        title: "Around This Time",
        subtitle: "A seasonal snapshot from around this time in past years.",
        items: aroundItems,
        totalCount: aroundSnapshotItems.length,
        actionLabel: aroundSnapshotItems.length > aroundItems.length ? "See snapshot" : undefined,
        emptyTitle: "Nothing seasonal yet",
        emptySubtitle: "Check back later.",
      },
    ],
    aroundSnapshot: {
      title: "Around This Time",
      subtitle: "A seasonal snapshot from around this point in past years.",
      windowLabel: formatAroundSnapshotWindowLabel(now),
      year: aroundSnapshotWindow.year,
      startTs: aroundSnapshotWindow.startTs,
      endTs: aroundSnapshotWindow.endTs,
      items: aroundSnapshotItems,
    },
  };
}

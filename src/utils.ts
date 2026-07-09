import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator";
import * as FileSystem from "expo-file-system/legacy";
import { Collection, SongIdea, Workspace } from "./types";
import { collectClipAudioUris } from "./services/managedMedia";

const aestheticWords = [
  "echo", "chorus", "harmony", "static", "pulse", "midnight", "neon", "velvet",
  "sunrise", "hush", "reverb", "tempo", "glow", "signal", "shadow", "stardust",
  "drift", "moondust", "spark", "voyage", "melody", "rhythm", "beat", "bass",
  "treble", "synth", "groove", "vibe", "wave", "tide", "storm", "breeze",
  "whisper", "thunder", "light", "color", "spectrum", "prism", "crystal",
  "diamond", "gold", "silver", "bronze", "fire", "water", "earth", "air",
  "ether", "space", "time", "dimension", "galaxy", "universe", "cosmos",
  "star", "planet", "moon", "sun", "comet", "meteor", "asteroid", "nebula",
  "quasar", "pulsar", "supernova", "gravity", "orbit", "eclipse", "zenith",
  "nadir", "horizon", "skyline", "city", "street", "highway", "tunnel",
  "laser", "smoke", "fog", "mist", "rain", "snow", "ice", "stone", "river",
  "ocean", "sea", "mountain", "valley", "canyon", "desert", "forest", "jungle",
  "island", "oasis", "phantom", "ghost", "spirit", "dream", "vision",
  "illusion", "magic", "spell", "potion", "elixir", "secret", "mystery",
  "riddle", "journey", "quest", "adventure", "tale", "myth", "legend", "fable",
  "epic", "anthem", "ballad", "delay", "fuzz", "distortion", "overdrive",
  "session", "record", "tape", "vinyl", "cassette", "stream", "acoustic",
  "electric", "digital", "analog", "retro", "vintage", "modern", "future", "cyber",
  "abyss", "aeon", "alchemy", "amber", "amethyst", "anomaly", "apex", "arcane",
  "archive", "arena", "array", "ash", "aura", "aurora", "autumn", "avalanche",
  "avatar", "axis", "azure", "beacon", "biosphere", "blaze", "blight", "blizzard",
  "bloom", "bluff", "border", "boulder", "boundary", "cascade", "cataclysm",
  "celestial", "centrifuge", "chaos", "chasm", "chronicle", "cinder", "cipher",
  "citadel", "clay", "cliff", "cloud", "code", "comet", "compass", "compound",
  "concord", "conduit", "core", "corona", "corridor", "crater", "crest",
  "crimson", "crown", "crux", "crypt", "curse", "cyclone", "dawn", "debris",
  "delta", "demon", "depths", "destiny", "dew", "diode", "dome", "dune",
  "dusk", "dust", "dynamo", "echo", "eden", "edge", "effigy", "element",
  "ember", "emerald", "enigma", "entity", "epoch", "equinox", "essence", "eternity",
  "exile", "exodus", "fable", "facade", "facet", "fall", "fate", "fault",
  "fern", "field", "flare", "flash", "fleece", "flora", "flux", "focus",
  "forge", "form", "fossil", "fractal", "fragment", "frame", "frontier", "frost",
  "fury", "fusion", "gamut", "garden", "gate", "gauge", "genesis", "geo",
  "glacier", "glass", "gleam", "glimmer", "glitch", "globe", "glory", "glyph",
  "gorge", "grace", "grid", "grim", "grotto", "grove", "guardian", "gulf",
  "halo", "harbor", "haven", "haze", "helix", "herald", "hex", "hollow",
  "hologram", "hope", "horizon", "hour", "hunter", "hybrid", "icon", "idle",
  "idol", "ignite", "illusion", "image", "impact", "impulse", "incense", "index",
  "inferno", "infinity", "ink", "iron", "isotope", "ivy", "jade", "jaw",
  "jewel", "journal", "judge", "jump", "karma", "keep", "key", "kin",
  "kinetic", "knight", "knot", "labyrinth", "lace", "lake", "lamp", "lance",
  "lane", "lantern", "laser", "lattice", "lava", "leaf", "legacy", "lens",
  "level", "life", "limit", "line", "link", "liquid", "lithium", "logic",
  "loom", "loop", "lore", "lotus", "lucid", "lumen", "lunar", "lure",
  "lyric", "machina", "machine", "macro", "maelstrom", "magnet", "magma", "mantle",
  "marble", "margin", "mark", "marsh", "mask", "mass", "matrix", "matter",
  "maze", "meadow", "mechanic", "medina", "mega", "memory", "mercury", "merge",
  "meridian", "mesa", "mesh", "message", "metal", "meteor", "method", "metro",
  "micro", "mile", "mind", "mine", "mirage", "mirror", "mist", "mold",
  "molecule", "moment", "monarch", "monolith", "mood", "moon", "morgue", "morning",
  "morph", "mosaic", "moss", "moth", "motion", "motive", "motor", "mount",
  "muse", "mutant", "myth", "nadir", "nano", "nature", "nebula", "nectar",
  "needle", "nemesis", "neon", "nerve", "nest", "network", "neuron", "nexus"
];

export const fmt = (ms = 0) => {
  const isNegative = ms < 0;
  ms = Math.abs(ms);
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const tenths = Math.floor((ms % 1000) / 10);

  const sign = isNegative ? "-" : "";
  const secStr = String(secs).padStart(2, "0");
  const tenthsStr = String(tenths).padStart(2, "0");

  if (hrs > 0) {
    return `${sign}${hrs}:${String(mins).padStart(2, "0")}:${secStr}`;
  }
  return `${sign}${String(mins).padStart(2, "0")}:${secStr}.${tenthsStr}`;
};

export const fmtTenths = (ms = 0) => {
  const isNegative = ms < 0;
  ms = Math.abs(ms);
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const tenths = Math.floor((ms % 1000) / 100);

  const sign = isNegative ? "-" : "";
  const secStr = String(secs).padStart(2, "0");

  if (hrs > 0) {
    return `${sign}${hrs}:${String(mins).padStart(2, "0")}:${secStr}`;
  }
  return `${sign}${String(mins).padStart(2, "0")}:${secStr}.${tenths}`;
};

export const fmtDuration = (ms = 0) => {
  const isNegative = ms < 0;
  ms = Math.abs(ms);
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);

  const sign = isNegative ? "-" : "";
  const secStr = String(secs).padStart(2, "0");

  if (hrs > 0) {
    return `${sign}${hrs}:${String(mins).padStart(2, "0")}:${secStr}`;
  }
  return `${sign}${String(mins).padStart(2, "0")}:${secStr}`;
};

export const formatDate = (ts: number) => new Date(ts).toLocaleString();

/**
 * One cohesive, minimal date voice for clip cards across the app. Recency-first,
 * collapsing to the smallest unambiguous form and only showing the year when it
 * isn't the current one:
 *
 *   Just now · 12m ago · 3h ago        (today)
 *   Yesterday
 *   Tue                                 (2–6 days ago — weekday)
 *   Jun 26                              (this year)
 *   Jun 26 2024                         (older)
 *
 * Cohesion with timeline dividers: pass the item's section label (Today / Last
 * week / Last month …). If the card's own label would just echo that section,
 * it drops to the clock time instead — so the card always adds the finer detail
 * the divider doesn't, never repeating it. (In practice only "Yesterday" collides.)
 */
export const formatClipDate = (ts: number, sectionLabel?: string): string => {
  const now = Date.now();
  const date = new Date(ts);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / 86_400_000);

  let label: string;
  if (dayDiff <= 0) {
    const mins = Math.floor(Math.max(0, now - ts) / 60_000);
    if (mins < 1) label = "Just now";
    else if (mins < 60) label = `${mins}m ago`;
    else label = `${Math.floor(mins / 60)}h ago`;
  } else if (dayDiff === 1) {
    label = "Yesterday";
  } else if (dayDiff < 7) {
    label = date.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const sameYear = date.getFullYear() === new Date(now).getFullYear();
    label = sameYear ? `${month} ${date.getDate()}` : `${month} ${date.getDate()} ${date.getFullYear()}`;
  }

  if (sectionLabel && label === sectionLabel) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return label;
};

/** @deprecated Use genRootClipTitle / genChildClipTitle instead. */
export const genClipTitle = (idea: string, v: number) => `${idea} v${v}`;

/** Strips a trailing " vN" version suffix, e.g. "Chorus Hook v3" → "Chorus Hook". */
export function getBaseClipTitle(title: string): string {
  return title.replace(/\s+v\d+$/, "").trim();
}

/** Extracts the trailing version number from a title, e.g. "Chorus Hook v3" → 3. Returns null if none. */
export function extractClipVersionNumber(title: string): number | null {
  const match = title.match(/\s+v(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/** How many parent hops from clipId to the lineage root (0 = root itself). */
export function getLineageDepth(clips: import("./types").ClipVersion[], clipId: string): number {
  let depth = 0;
  let currentId: string | undefined = clipId;
  while (currentId) {
    const current = clips.find((c) => c.id === currentId);
    if (!current?.parentClipId) break;
    depth++;
    currentId = current.parentClipId;
  }
  return depth;
}

/**
 * Auto-title for a new parentless (root) clip within a song.
 * Counts existing roots and returns "Idea N".
 */
export function genRootClipTitle(clips: import("./types").ClipVersion[]): string {
  const rootCount = clips.filter((c) => !c.parentClipId).length;
  return `Idea ${rootCount + 1}`;
}

/**
 * Auto-title for a new child/reply clip.
 * Uses the parent's base title + the next version number in the lineage chain.
 * e.g. parent "Chorus Hook" (depth 0) → "Chorus Hook v2"
 *      parent "Chorus Hook v2" (depth 1) → "Chorus Hook v3"
 */
export function genChildClipTitle(
  clips: import("./types").ClipVersion[],
  parentClip: import("./types").ClipVersion
): string {
  const depth = getLineageDepth(clips, parentClip.id);
  const baseTitle = getBaseClipTitle(parentClip.title);
  return `${baseTitle} v${depth + 2}`;
}

export const buildDefaultIdeaTitle = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? "st"
    : day === 2 || day === 22 ? "nd"
    : day === 3 || day === 23 ? "rd"
    : "th";
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(" ", "");
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${time} ${month} ${day}${suffix}`;
};

/** True when `title` is still the unedited auto-generated timestamp from `buildDefaultIdeaTitle`. */
export function isDefaultIdeaTitle(title: string, createdAt: number) {
  return title === buildDefaultIdeaTitle(createdAt);
}

export function ensureUniqueIdeaTitle(baseTitle: string, existingTitles: string[]) {
  const normalizedExisting = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
  if (!normalizedExisting.has(baseTitle.trim().toLowerCase())) {
    return baseTitle;
  }

  let suffix = 2;
  let candidate = `${baseTitle} (${suffix})`;
  while (normalizedExisting.has(candidate.trim().toLowerCase())) {
    suffix += 1;
    candidate = `${baseTitle} (${suffix})`;
  }
  return candidate;
}

export function ensureUniqueCountedTitle(baseTitle: string, existingTitles: string[]) {
  const trimmedBaseTitle = baseTitle.trim();
  if (!trimmedBaseTitle) {
    return baseTitle;
  }

  const normalizedExisting = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
  if (!normalizedExisting.has(trimmedBaseTitle.toLowerCase())) {
    return trimmedBaseTitle;
  }

  const suffixMatch = trimmedBaseTitle.match(/^(.*)\s\((\d+)\)$/);
  const rootTitle = suffixMatch?.[1]?.trim() || trimmedBaseTitle;

  let suffix = 1;
  let candidate = `${rootTitle} (${suffix})`;
  while (normalizedExisting.has(candidate.trim().toLowerCase())) {
    suffix += 1;
    candidate = `${rootTitle} (${suffix})`;
  }

  return candidate;
}

export const genIdea = () => {
  const dictionaries =
    Math.random() > 0.55 ? [adjectives, aestheticWords, animals] : [adjectives, aestheticWords];

  return uniqueNamesGenerator({
    dictionaries,
    separator: " ",
    style: "capital",
    length: Math.min(dictionaries.length, Math.random() > 0.55 ? 3 : 2),
  });
};

/**
 * Round a 0..1 amplitude to 3 decimals before it enters persisted state. Peaks are
 * the dominant weight of the library snapshot (256 per clip): full-precision doubles
 * serialize at ~17 chars each, quantized at ~5 — roughly a 3-4x cut of every library
 * save and boot parse. 1/1000 precision is far below what any on-screen bar can show.
 */
export function quantizeWaveformPeak(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function buildStaticWaveform(seedInput: string, count = 150) {
  let seed = 0;
  for (let i = 0; i < seedInput.length; i++) {
    seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0;
  }

  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const n = seed / 4294967295;
    const shape = 0.25 + 0.75 * Math.abs(Math.sin((i / count) * Math.PI * 2.3));
    bars.push(quantizeWaveformPeak(Math.max(0.12, Math.min(1, (0.25 + n * 0.75) * shape))));
  }
  return bars;
}

export function metersToWaveformPeaks(meters: number[], bins = 150) {
  if (!meters.length) return Array.from({ length: bins }, () => 0.004);

  // Normalize a dB level (-60..0) to a 0-1 bar height with only a mild lift. The
  // old curve over-emphasized room tone, making quiet regions look much louder.
  const normalizeDb = (db: number) => {
    const clamped = Math.max(-60, Math.min(0, Number.isFinite(db) ? db : -60));
    return quantizeWaveformPeak(Math.max(0.004, Math.min(1, Math.pow((clamped + 60) / 60, 1.15))));
  };

  const peaks: number[] = [];

  // Fewer samples than bins (e.g. a short recording → ~13 points/sec): linearly
  // interpolate between the real samples across the full width. Stretching by
  // nearest-neighbour instead repeated each value in flat steps (blocky groups of
  // identical bars); interpolation reads as a smooth, variable envelope. (And it
  // never squishes into the left with a flat tail, the original bug.)
  if (meters.length <= bins) {
    const lastIndex = meters.length - 1;
    if (lastIndex <= 0) {
      return Array.from({ length: bins }, () => normalizeDb(meters[0]));
    }
    const span = bins > 1 ? bins - 1 : 1;
    for (let i = 0; i < bins; i++) {
      const pos = (i * lastIndex) / span;
      const lo = Math.floor(pos);
      const hi = Math.min(lastIndex, lo + 1);
      const frac = pos - lo;
      const loDb = Number.isFinite(meters[lo]) ? meters[lo] : -60;
      const hiDb = Number.isFinite(meters[hi]) ? meters[hi] : -60;
      peaks.push(normalizeDb(loDb + (hiDb - loDb) * frac));
    }
    return peaks;
  }

  // More samples than bins: downsample by peak (max dB) per bucket.
  for (let i = 0; i < bins; i++) {
    const start = Math.floor((i * meters.length) / bins);
    const end = i === bins - 1 ? meters.length : Math.floor(((i + 1) * meters.length) / bins);
    let maxDb = -60;
    for (let j = start; j < end; j++) {
      const value = meters[j];
      if (Number.isFinite(value) && value > maxDb) maxDb = value;
    }
    peaks.push(normalizeDb(maxDb));
  }

  return peaks;
}

/** Sums every file-backed audio URI on a clip — master take, pre-edit source,
 *  overdub layer recordings, and the rendered mix. */
async function getClipMediaSizeBytes(clip: SongIdea["clips"][number]): Promise<number> {
  let totalBytes = 0;
  for (const uri of collectClipAudioUris(clip)) {
    if (uri.startsWith("blob:")) continue;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && info.size) {
        totalBytes += info.size;
      }
    } catch (e) {
      console.warn("Failed to get file size for", uri, e);
    }
  }
  return totalBytes;
}

export async function getWorkspaceSizeBytes(workspace: Workspace): Promise<number> {
  let totalBytes = 0;
  for (const idea of workspace.ideas) {
    totalBytes += await getIdeaSizeBytes(idea);
  }
  return totalBytes;
}

export async function getIdeaSizeBytes(idea: SongIdea): Promise<number> {
  let totalBytes = 0;
  for (const clip of idea.clips) {
    totalBytes += await getClipMediaSizeBytes(clip);
  }
  return totalBytes;
}

export function getCollectionScopeIds(workspace: Workspace, collectionId: string) {
  const ids = new Set<string>();
  const walk = (targetId: string) => {
    ids.add(targetId);
    for (const collection of workspace.collections) {
      if (collection.parentCollectionId === targetId && !ids.has(collection.id)) {
        walk(collection.id);
      }
    }
  };
  walk(collectionId);
  return ids;
}

export function getCollectionById(workspace: Workspace, collectionId: string) {
  return workspace.collections.find((collection) => collection.id === collectionId) ?? null;
}

export function getCollectionChildren(workspace: Workspace, collectionId: string) {
  return workspace.collections.filter((collection) => collection.parentCollectionId === collectionId);
}

export function getCollectionAncestors(workspace: Workspace, collectionId: string) {
  const ancestors: Collection[] = [];
  let current = getCollectionById(workspace, collectionId) ?? null;

  while (current?.parentCollectionId) {
    const parent = getCollectionById(workspace, current.parentCollectionId);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
}

export function getCollectionDepth(workspace: Workspace, collectionId: string) {
  return getCollectionAncestors(workspace, collectionId).length;
}

export function getCollectionDescendantIds(workspace: Workspace, collectionId: string) {
  const ids = new Set<string>();
  const walk = (targetId: string) => {
    for (const collection of workspace.collections) {
      if (collection.parentCollectionId === targetId && !ids.has(collection.id)) {
        ids.add(collection.id);
        walk(collection.id);
      }
    }
  };
  walk(collectionId);
  return ids;
}

export function getCollectionIdeaCount(workspace: Workspace, collectionId: string) {
  const scopeIds = getCollectionScopeIds(workspace, collectionId);
  return workspace.ideas.filter((idea) => scopeIds.has(idea.collectionId)).length;
}

export async function getCollectionSizeBytes(workspace: Workspace, collectionId: string): Promise<number> {
  const scopeIds = getCollectionScopeIds(workspace, collectionId);
  const ideas = workspace.ideas.filter((idea) => scopeIds.has(idea.collectionId));
  let totalBytes = 0;
  for (const idea of ideas) {
    totalBytes += await getIdeaSizeBytes(idea);
  }
  return totalBytes;
}

export function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 KB";
  const k = 1024;
  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, idx);
  const precision = idx <= 1 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[idx]}`;
}

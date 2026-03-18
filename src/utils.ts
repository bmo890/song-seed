import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator";
import * as FileSystem from "expo-file-system/legacy";
import { Collection, SongIdea, Workspace } from "./types";

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

export const genClipTitle = (idea: string, v: number) => `${idea} v${v}`;

export const buildDefaultIdeaTitle = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const datePart = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  return `${timePart} ${datePart}`;
};

export function ensureUniqueIdeaTitle(baseTitle: string, existingTitles: string[]) {
  const normalizedExisting = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
  if (!normalizedExisting.has(baseTitle.trim().toLowerCase())) {
    return baseTitle;
  }

  let suffix = 2;
  let candidate = `${baseTitle} v${suffix}`;
  while (normalizedExisting.has(candidate.trim().toLowerCase())) {
    suffix += 1;
    candidate = `${baseTitle} v${suffix}`;
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

export function buildStaticWaveform(seedInput: string, count = 88) {
  let seed = 0;
  for (let i = 0; i < seedInput.length; i++) {
    seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0;
  }

  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const n = seed / 4294967295;
    const shape = 0.25 + 0.75 * Math.abs(Math.sin((i / count) * Math.PI * 2.3));
    bars.push(Math.max(0.12, Math.min(1, (0.25 + n * 0.75) * shape)));
  }
  return bars;
}

export function metersToWaveformPeaks(meters: number[], bins = 96) {
  if (!meters.length) return Array.from({ length: bins }, () => 0.02);
  const peaks: number[] = [];
  const chunk = Math.max(1, Math.floor(meters.length / bins));

  for (let i = 0; i < bins; i++) {
    const start = i * chunk;
    const end = i === bins - 1 ? meters.length : Math.min(meters.length, start + chunk);
    const slice = meters.slice(start, end);
    const maxDb = slice.length ? Math.max(...slice) : -60;
    const clamped = Math.max(-60, Math.min(0, maxDb));
    // Normalize dB (-60 to 0) to a 0-1 scale, then apply a curve to boost quiet sounds
    const normalized = (clamped + 60) / 60;
    peaks.push(Math.max(0.02, Math.min(1, Math.pow(normalized, 1.5))));
  }

  return peaks;
}

export async function getWorkspaceSizeBytes(workspace: Workspace): Promise<number> {
  let totalBytes = 0;
  for (const idea of workspace.ideas) {
    for (const clip of idea.clips) {
      if (clip.audioUri && !clip.audioUri.startsWith("blob:")) {
        try {
          const info = await FileSystem.getInfoAsync(clip.audioUri);
          if (info.exists && info.size) {
            totalBytes += info.size;
          }
        } catch (e) {
          console.warn("Failed to get file size for", clip.audioUri, e);
        }
      }
    }
  }
  return totalBytes;
}

export async function getIdeaSizeBytes(idea: SongIdea): Promise<number> {
  let totalBytes = 0;
  for (const clip of idea.clips) {
    if (clip.audioUri && !clip.audioUri.startsWith("blob:")) {
      try {
        const info = await FileSystem.getInfoAsync(clip.audioUri);
        if (info.exists && info.size) {
          totalBytes += info.size;
        }
      } catch (e) {
        console.warn("Failed to get file size for", clip.audioUri, e);
      }
    }
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

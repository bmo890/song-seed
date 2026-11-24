// Builds the Hebrew review sheet (founder, 2026-11-20): every Hebrew line the app
// shows, once, grouped by the page it lives on and the kind of text it is, for a
// native translator to go over at songnook.app/review/he/<link>.
//
//   node scripts/i18n/he-review/build.mjs
//
// Writes server/songnook-send/src/review/heSheet.generated.ts (the worker serves
// it) and prints the counts. Lines:
// - a key and its plural forms are one line (Hebrew has more forms than English);
// - keys with the same English AND the same Hebrew are one line ("used in N places");
// - keys nothing in the app reads any more are left out;
// - the same English translated differently elsewhere is flagged, not merged
//   (Hebrew genders may need two renderings).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { ROOT, readCatalog, leaves } from "../catalog.mjs";

const PLURAL = /_(zero|one|two|few|many|other)$/;
const en = Object.fromEntries(leaves(readCatalog("en")));
const he = Object.fromEntries(leaves(readCatalog("he")));

// ── Where each key is read ───────────────────────────────────────────────────
const files = execSync("git ls-files src App.tsx", { cwd: ROOT })
  .toString()
  .trim()
  .split("\n")
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .filter((f) => !f.includes("/locales/") && !f.includes("__tests__") && !f.startsWith("src/i18n/translations"));
const sources = files.map((file) => ({ file, text: fs.readFileSync(path.join(ROOT, file), "utf8") }));

/** Every place a full key is quoted, and every `prefix.${…}` template prefix. */
const quotedAt = new Map(); // key -> [{file, context}]
const dynamicPrefixes = new Map(); // prefix -> [file]
for (const { file, text } of sources) {
  for (const m of text.matchAll(/["'`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)["'`]/g)) {
    const key = m[1];
    const start = Math.max(0, m.index - 160);
    const context = text.slice(start, m.index + key.length + 40);
    if (!quotedAt.has(key)) quotedAt.set(key, []);
    quotedAt.get(key).push({ file, context });
  }
  // `prefix.${…}` and `prefix_${…}`: every key starting with the prefix may be read.
  for (const m of text.matchAll(/[`"']([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*[._])\$\{/g)) {
    if (!dynamicPrefixes.has(m[1])) dynamicPrefixes.set(m[1], []);
    dynamicPrefixes.get(m[1]).push(file);
  }
}

function usesOf(base) {
  const direct = quotedAt.get(base) ?? [];
  if (direct.length) return direct;
  let best = "";
  for (const prefix of dynamicPrefixes.keys()) if (base.startsWith(prefix) && prefix.length > best.length) best = prefix;
  return best ? dynamicPrefixes.get(best).map((file) => ({ file, context: "" })) : [];
}

// ── Page and kind ────────────────────────────────────────────────────────────
const PAGE_BY_FOLDER = {
  ActivityScreen: "Activity",
  BluetoothCalibrationScreen: "Headphone calibration",
  ChordSheetScreen: "Chord chart",
  CutUpScreen: "Lyric Spark · Cut-Up",
  EditorScreen: "Clip editor",
  IdeaDetailScreen: "Sketch",
  IdeaListScreen: "Collection",
  LibraryScreen: "Compilations",
  LyricsScreen: "Lyrics",
  LyricsVersionScreen: "Lyrics",
  MagpieScreen: "Lyric Spark · Borrowed Words",
  MetronomeScreen: "Metronome",
  NotepadScreen: "Lyric Pad",
  PlayerScreen: "Player",
  ReceivedScreen: "Received",
  RecentlyDeletedScreen: "Recently deleted",
  RecordingScreen: "Recorder",
  RevisitScreen: "Revisit",
  SearchScreen: "Search",
  SetlistSongScreen: "Setlists",
  SettingsScreen: "Settings",
  ShareImportScreen: "Import",
  ShelfScreen: "Shelf",
  SongbookReaderScreen: "Chart book reader",
  TransferReceiveScreen: "Receiving a link",
  TunerScreen: "Tuner",
  WordLadderScreen: "Lyric Spark · Word Ladder",
  WorkspaceBrowseScreen: "Workspaces",
  WorkspaceListScreen: "Workspaces",
  welcome: "Welcome tour",
};
/** Pages named by the catalog section when the code is shared (common/, services/). */
const PAGE_BY_SECTION = {
  welcome: "Welcome tour",
  pro: "Pro",
  proPage: "Pro",
  metronome: "Metronome",
  tuner: "Tuner",
  player: "Player",
  recording: "Recorder",
  magpie: "Lyric Spark · Borrowed Words",
  cutUp: "Lyric Spark · Cut-Up",
  wordLadder: "Lyric Spark · Word Ladder",
  wordLadderHelp: "Lyric Spark · Word Ladder",
  wordSparks: "Lyric Spark",
  wordFinderUi: "Word finder",
  chordChart: "Chord chart",
  received: "Received",
  revisit: "Revisit",
  shelf: "Shelf",
  activity: "Activity",
  bluetoothCalibration: "Headphone calibration",
  workspaceArchive: "Workspaces",
  settingsStorage: "Settings",
  settingsBackup: "Settings",
  settingsAbout: "Settings",
  settingsExport: "Settings",
  library: "Compilations",
  songDetail: "Sketch",
  editor: "Clip editor",
  lyrics: "Lyrics",
  collection: "Collection",
  selection: "Selecting several",
};

function pageOfFile(file) {
  const m = file.match(/^src\/components\/([^/]+)\//);
  if (m && PAGE_BY_FOLDER[m[1]]) return PAGE_BY_FOLDER[m[1]];
  if (file === "App.tsx") return null;
  return null;
}

const KINDS = ["Title", "On screen", "Button", "Menu", "Pop-up", "Message", "Empty screen", "Placeholder", "Screen reader"];

function kindOf(context, file, key) {
  const c = context;
  if (/accessibilityLabel|accessibilityHint|A11y\b/.test(c) || /A11y$/.test(key)) return "Screen reader";
  // A stepper's − and + are glyphs: their words only reach a screen reader (Stepper.tsx).
  if (/(increment|decrement)Label=\{t\($/.test(c.slice(0, c.lastIndexOf(key) - 1).trimEnd())) return "Screen reader";
  if (/toast\(\s*[^)]*$|toast\(t\(/.test(c) || /toast\(/.test(c.slice(-120))) return "Message";
  if (/AppAlert\.|Alert\.alert|AppDialog/.test(c.slice(-200))) return "Pop-up";
  if (/EmptyState/.test(c)) return "Empty screen";
  if (/placeholder=|placeholder:/.test(c.slice(-80))) return "Placeholder";
  if (/SelectionActionSheet|PopoverMenuRow|PopoverRadioRow|AppAlert\.menu|actionIcons\./.test(c) || /Menu|Sheet/.test(path.basename(file)) && /label[=:]/.test(c.slice(-60)))
    return "Menu";
  if (/<Button|InkLink|InkKey|label=\{t\(/.test(c.slice(-90))) return "Button";
  if (/title=|Title\b|ScreenHeader|eyebrow/.test(c.slice(-90)) || /(^|\.)(title|heading|eyebrow)$/i.test(key.split(".").pop()))
    return "Title";
  return "On screen";
}

// ── Units: a key with its plural forms ───────────────────────────────────────
const units = new Map();
for (const key of Object.keys(he)) {
  const base = key.replace(PLURAL, "");
  if (!units.has(base)) units.set(base, []);
  units.get(base).push(key);
}

const unused = [];
const nothingToTranslate = [];
const lines = new Map(); // signature -> line
/** Only tokens, numbers and marks ("{{count}}", "{{a}} · {{b}}"): no words to translate. */
const hasWords = (text) => /\p{L}/u.test(text.replace(/\{\{\s*\w+\s*\}\}/g, ""));
for (const [base, keys] of units) {
  const uses = usesOf(base);
  if (uses.length === 0) {
    unused.push(base);
    continue;
  }
  if (!keys.some((key) => hasWords(en[key] ?? en[key.replace(PLURAL, "_other")] ?? "") || hasWords(he[key] ?? ""))) {
    nothingToTranslate.push(base);
    continue;
  }
  const forms = keys.map((key) => {
    const form = PLURAL.test(key) ? key.match(PLURAL)[1] : "";
    const english = en[key] ?? en[key.replace(PLURAL, "_other")] ?? en[base] ?? "";
    return { form, en: english, he: he[key] };
  });
  const section = base.split(".")[0];
  const pages = new Set(uses.map((u) => pageOfFile(u.file)).filter(Boolean));
  const page = pages.size === 1 ? [...pages][0] : pages.size > 1 ? "Shared across the app" : PAGE_BY_SECTION[section] ?? "Shared across the app";
  const kinds = uses.map((u) => (u.context ? kindOf(u.context, u.file, base) : "On screen"));
  const kind = kinds.sort((a, b) => KINDS.indexOf(a) - KINDS.indexOf(b))[0];
  const sig = JSON.stringify(forms.map((f) => [f.form, f.en, f.he]));
  if (!lines.has(sig)) lines.set(sig, { keys: [], forms, pages: new Set(), kinds: new Set(), files: new Set() });
  const line = lines.get(sig);
  line.keys.push(base);
  line.pages.add(page);
  line.kinds.add(kind);
  for (const u of uses) line.files.add(u.file.replace(/^src\/components\//, ""));
}

// Same English, different Hebrew elsewhere: flag both, never merge.
const byEnglish = new Map();
for (const line of lines.values()) {
  const e = JSON.stringify(line.forms.map((f) => [f.form, f.en]));
  if (!byEnglish.has(e)) byEnglish.set(e, []);
  byEnglish.get(e).push(line);
}

// Headlines: the welcome tour, the Pro page, and every title and empty screen.
const HEADLINE_PAGES = new Set(["Welcome tour", "Pro"]);

let n = 0;
const items = [];
for (const line of lines.values()) {
  const pages = [...line.pages];
  const page = pages.length > 1 ? "Shared across the app" : pages[0];
  const kind = [...line.kinds].sort((a, b) => KINDS.indexOf(a) - KINDS.indexOf(b))[0];
  const headline = HEADLINE_PAGES.has(page) || kind === "Title" || kind === "Empty screen";
  const twins = byEnglish.get(JSON.stringify(line.forms.map((f) => [f.form, f.en]))).filter((l) => l !== line);
  items.push({
    id: line.keys[0],
    keys: line.keys,
    section: headline ? "Headlines" : page,
    page,
    kind,
    forms: line.forms,
    where: [...line.files].slice(0, 3),
    otherHebrew: twins.map((t) => t.forms.map((f) => f.he).join(" / ")),
  });
  n += 1;
}

// Order: Headlines, then pages A–Z, then Shared; within a section by kind, then English.
const sectionRank = (s) => (s === "Headlines" ? "0" : s === "Shared across the app" ? "2" : "1" + s);
items.sort(
  (a, b) =>
    sectionRank(a.section).localeCompare(sectionRank(b.section)) ||
    KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
    a.forms[0].en.localeCompare(b.forms[0].en)
);

// ── Key terms: the app's own words, decided once ─────────────────────────────
const TERMS = [
  ["idea", "Anything in progress: a clip or a sketch."],
  ["clip", "A recorded fragment."],
  ["sketch", "A song in progress: its takes, lyrics, chart and notes."],
  ["take", "A recording inside a sketch."],
  ["song", "A finished song."],
  ["collection", "A folder of ideas inside a workspace."],
  ["workspace", "A project or band: holds collections."],
  ["layer", "A recording added over a take (a harmony, a second guitar)."],
  ["Lyric Pad", "The place for loose lyric pages."],
  ["Lyric Spark", "Word games that knock new lines loose."],
  ["Shelf", "Set an idea aside for seven days."],
  ["Revisit", "Brings back old, unfinished ideas each day."],
  ["Send", "Sharing by link."],
  ["chart", "The chords and sections of a song."],
  ["setlist", "Songs in order for a show."],
  ["Pro", "The paid plan."],
];
/** The Hebrew the app uses now for a term: the line whose English is the term itself
 *  (singular form first), else the commonest translation of it. */
function currentHebrew(term) {
  const want = term.toLowerCase();
  const hits = Object.keys(en).filter((k) => en[k].toLowerCase() === want && he[k]);
  const singular = hits.find((k) => /_one$/.test(k)) ?? hits[0];
  return singular ? he[singular] : "";
}
const terms = TERMS.map(([term, meaning]) => ({ id: `term:${term}`, term, meaning, he: currentHebrew(term) }));

const totalForms = items.reduce((s, i) => s + i.forms.length, 0);
const words = items.reduce((s, i) => s + i.forms[0].en.split(/\s+/).filter(Boolean).length, 0);
const sheet = {
  builtAt: new Date().toISOString().slice(0, 10),
  counts: {
    catalogKeys: Object.keys(he).length,
    lines: items.length,
    hebrewForms: totalForms,
    englishWords: words,
    keysCovered: items.reduce((s, i) => s + i.keys.length, 0),
    unusedLeftOut: unused.length,
    nothingToTranslate: nothingToTranslate.length,
    flaggedDifferent: items.filter((i) => i.otherHebrew.length).length,
  },
  terms,
  items,
};

const out = path.join(ROOT, "server/songnook-send/src/review/heSheet.generated.ts");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  `// GENERATED by scripts/i18n/he-review/build.mjs — do not edit by hand.\n` +
    `/* eslint-disable */\nexport const HE_SHEET = ${JSON.stringify(sheet)} as const;\n`
);
fs.writeFileSync(path.join(ROOT, "scripts/i18n/he-review/unused-keys.txt"), unused.sort().join("\n") + "\n");
console.log(sheet.counts);
const bySection = new Map();
for (const i of items) bySection.set(i.section, (bySection.get(i.section) ?? 0) + 1);
console.log([...bySection.entries()].map(([s, c]) => `${s}: ${c}`).join("\n"));
const byKind = new Map();
for (const i of items) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
console.log([...byKind.entries()].map(([s, c]) => `${s}: ${c}`).join("  "));

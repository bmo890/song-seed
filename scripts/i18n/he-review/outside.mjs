// The Hebrew people read OUTSIDE the app (founder, 2026-11-24: "make sure it includes
// everything"): the store listing, the Send page a link opens in a browser, and
// songnook.app. None of it is in the app's catalog, so the review sheet takes it from
// where each lives:
// - store listing: docs/product-plan/store-truth.md (English) and
//   store-listing-translations.md (Hebrew), the 2026-11-23 copy;
// - Send page:     server/songnook-send/src/pages/sendI18n.ts;
// - website:       server/songnook-send/src/pages/landingI18n.ts;
// - phone prompts: languages/he.json (the iPhone's microphone / photos / Face ID questions).
// A fix made on the sheet is applied back to those files by hand (apply.mjs lists them).
// Every extraction is asserted: a document that changes shape stops the build rather
// than quietly dropping lines from the translator's sheet.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../catalog.mjs";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const must = (value, what) => {
  if (value == null || value === "") throw new Error(`he-review/outside: could not find ${what}`);
  return value;
};
const hasHebrew = (s) => /[֐-׿]/.test(s);
const item = (section, id, kind, forms) => ({ id, keys: [], section, page: section, kind, forms, where: [], otherHebrew: [] });

// ── Store listing ────────────────────────────────────────────────────────────
function storeItems() {
  const SECTION = "Store listing";
  const truth = read("docs/product-plan/store-truth.md");
  const trans = read("docs/product-plan/store-listing-translations.md");
  const tick = (text, label) => must(text.match(new RegExp(`\\*\\*${label}[^*]*\\*\\*\\s*\`([^\`]+)\``))?.[1], label);
  const fence = (text, from) => must(text.slice(from).match(/```\w*\n([\s\S]*?)\n```/)?.[1], "a text block");

  const enAt = must(truth.indexOf("NEW CURRENT COPY for 1.0.3") + 1 || null, "the current English store copy") - 1;
  const en = truth.slice(enAt);
  const current = must(trans.indexOf("(CURRENT;") + 1 || null, "the current translations") - 1;
  const heAt = must(trans.indexOf("### Hebrew", current) + 1 || null, "the current Hebrew listing") - 1;
  const he = trans.slice(heAt);

  const out = [
    item(SECTION, "store:subtitle", "Subtitle", [{ form: "", en: tick(en, "Apple subtitle = Play short description:"), he: tick(he, "Subtitle / short description:") }]),
    item(SECTION, "store:promo", "Promotional text", [{ form: "", en: tick(en, "Apple promotional text:"), he: tick(he, "Apple promotional text:") }]),
    item(SECTION, "store:keywords", "Search keywords (keep the commas, no spaces)", [{ form: "", en: tick(en, "Apple keywords"), he: tick(he, "Apple keywords:") }]),
  ];
  const enParas = fence(truth, truth.indexOf("SongNook is for songwriters and working musicians") - 8).split(/\n\s*\n/);
  const heParas = fence(he, 0).split(/\n\s*\n/);
  if (enParas.length !== heParas.length) throw new Error(`he-review/outside: store description has ${enParas.length} English paragraphs, ${heParas.length} Hebrew`);
  enParas.forEach((p, i) => out.push(item(SECTION, `store:description.${i + 1}`, "Description", [{ form: "", en: p.trim(), he: heParas[i].trim() }])));

  // The subscription paragraph Apple's description ends with (first line; the two links follow).
  const enSub = must(truth.match(/^SongNook Pro is available as a yearly.*$/m)?.[0], "the English subscription paragraph");
  const heSub = must(trans.match(/^SongNook Pro זמין כמנוי.*$/m)?.[0], "the Hebrew subscription paragraph");
  out.push(item(SECTION, "store:subscription", "Description", [{ form: "", en: enSub, he: heSub }]));
  const terms = trans.match(/^(תנאי שימוש): https:\/\/songnook\.app\/terms$/m)?.[1];
  const privacy = trans.match(/^(מדיניות פרטיות): https:\/\/songnook\.app\/privacy$/m)?.[1];
  out.push(item(SECTION, "store:termsLabel", "Description", [{ form: "", en: "Terms of Use", he: must(terms, "the Hebrew terms label") }]));
  out.push(item(SECTION, "store:privacyLabel", "Description", [{ form: "", en: "Privacy Policy", he: must(privacy, "the Hebrew privacy label") }]));

  const newAt = must(truth.indexOf("**What's new, 1.0.3") + 1 || null, "the what's new text") - 1;
  out.push(item(SECTION, "store:whatsNew", "What's new", [{ form: "", en: fence(truth, newAt), he: must(truth.slice(newAt).match(/```he\n([\s\S]*?)\n```/)?.[1], "the Hebrew what's new") }]));
  for (const i of out) if (!hasHebrew(i.forms[0].he)) throw new Error(`he-review/outside: ${i.id} has no Hebrew`);
  return out;
}

// ── The two web surfaces: walk English and Hebrew side by side ───────────────
/** Leaves that are words to read: not a language name, a direction, a link or a bare brand. */
function pairs(en, he, skip) {
  const out = [];
  const walk = (a, b, trail) => {
    if (typeof a === "string") {
      const key = trail.join(".");
      if (typeof b !== "string") throw new Error(`he-review/outside: ${key} has no Hebrew twin`);
      if (skip(key, a, b)) return;
      out.push([key, a, b]);
    } else if (a && typeof a === "object") {
      for (const k of Object.keys(a)) walk(a[k], b?.[k], [...trail, k]);
    }
  };
  walk(en, he, []);
  return out;
}
const notWords = (key, a, b) => !/\p{L}{2}/u.test(b) || /^https?:/.test(b) || (a === b && !/\s/.test(a));

async function webItems() {
  const dir = path.join(ROOT, "server/songnook-send/src/pages");
  const { SEND_STRINGS } = await import(path.join(dir, "sendI18n.ts"));
  const { STRINGS } = await import(path.join(dir, "landingI18n.ts"));
  const out = [];
  // Send: a { one, other } pair is one line in two forms.
  for (const key of Object.keys(SEND_STRINGS.en)) {
    const a = SEND_STRINGS.en[key];
    const b = SEND_STRINGS.he[key];
    if (typeof a === "string") {
      if (notWords(key, a, b)) continue;
      out.push(item("Send web page", `web:send.${key}`, "On screen", [{ form: "", en: a, he: b }]));
    } else {
      out.push(item("Send web page", `web:send.${key}`, "On screen", [
        { form: "one", en: a.one, he: b.one },
        { form: "other", en: a.other, he: b.other },
      ]));
    }
  }
  const site = pairs(STRINGS.en, STRINGS.he, (key, a, b) => key === "name" || key === "dir" || notWords(key, a, b));
  for (const [key, a, b] of site) out.push(item("Website", `web:site.${key}`, /(title|H1|H2|H3)$/.test(key) ? "Title" : "On screen", [{ form: "", en: a, he: b }]));
  for (const i of out) for (const f of i.forms) if (!hasHebrew(f.he) && /[A-Za-z]{3}/.test(f.he) && f.he !== f.en) throw new Error(`he-review/outside: ${i.id} has no Hebrew`);
  return out;
}

// ── The iPhone's own permission questions (languages/he.json, next store build) ──
function promptItems() {
  const app = JSON.parse(read("app.json")).expo;
  const he = JSON.parse(read("languages/he.json"));
  const photos = app.plugins.map((p) => (Array.isArray(p) ? p[1]?.photosPermission : null)).find((v) => typeof v === "string");
  const english = {
    NSMicrophoneUsageDescription: app.ios.infoPlist.NSMicrophoneUsageDescription,
    NSFaceIDUsageDescription: app.ios.infoPlist.NSFaceIDUsageDescription,
    NSPhotoLibraryUsageDescription: photos,
  };
  return Object.keys(he).map((key) =>
    item("Phone prompts", `prompt:${key}`, "Pop-up", [{ form: "", en: must(english[key], `the English for ${key}`), he: he[key] }])
  );
}

export const OUTSIDE_SECTIONS = ["Phone prompts", "Store listing", "Send web page", "Website"];
export async function outsideItems() {
  return [...promptItems(), ...storeItems(), ...(await webItems())];
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { negotiateLang, STRINGS, LANGS } from "../../pages/landingI18n.ts";

test("the browser's first language we speak wins", () => {
  assert.equal(negotiateLang("he-IL,he;q=0.9,en-US;q=0.8", "US"), "he");
  assert.equal(negotiateLang("fr-FR,de;q=0.7,en;q=0.5", "FR"), "de");
  assert.equal(negotiateLang("en-US,en;q=0.9", "IL"), "en");
  assert.equal(negotiateLang("pt-BR", undefined), "pt");
});

test("weights decide, not order", () => {
  assert.equal(negotiateLang("en;q=0.4,es;q=0.9", "US"), "es");
});

test("the old Hebrew code still reads as Hebrew", () => {
  assert.equal(negotiateLang("iw", undefined), "he");
});

test("the country decides only when the browser names none of ours", () => {
  assert.equal(negotiateLang(undefined, "IL"), "he");
  assert.equal(negotiateLang("fr-FR,fr;q=0.9", "BR"), "pt");
  assert.equal(negotiateLang("fr-FR", "FR"), "en");
  assert.equal(negotiateLang("", undefined), "en");
});

test("every language says everything the English does", () => {
  const shape = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  for (const l of LANGS) assert.deepEqual(shape(STRINGS[l]), shape(STRINGS.en), l);
  assert.equal(STRINGS.he.dir, "rtl");
});

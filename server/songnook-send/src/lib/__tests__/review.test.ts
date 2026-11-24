import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseSave, placeholders, sheet, toCsv, toJson, tokenMatches, type ReviewEdit } from "../../review/reviewLib.ts";

const first = sheet.items[0];

test("only the link's own token opens the review", async () => {
  const token = "a-long-enough-review-token";
  const hash = createHash("sha256").update(token).digest("hex");
  assert.equal(await tokenMatches(token, hash), true);
  assert.equal(await tokenMatches(token, hash.toUpperCase()), true);
  assert.equal(await tokenMatches("a-long-enough-review-tokeN", hash), false);
  assert.equal(await tokenMatches("short", createHash("sha256").update("short").digest("hex")), false);
  assert.equal(await tokenMatches(token, undefined), false);
});

test("a save names a known line and keeps only typed forms", () => {
  assert.equal(parseSave({ itemId: "not.a.line", forms: {} }), null);
  assert.equal(parseSave({ itemId: first.id, forms: { weird: "x" } }), null);
  assert.equal(parseSave({ itemId: first.id, forms: { "": 5 } }), null);
  const save = parseSave({ itemId: first.id, forms: { "": "שלום", one: "   " }, note: "n", status: "changed" });
  assert.deepEqual(save, { itemId: first.id, forms: { "": "שלום" }, note: "n", status: "changed" });
  assert.equal(parseSave({ itemId: first.id, forms: {}, status: "deleted" })?.status, "");
  // Lines from outside the app (store listing, web pages) save like any other.
  const outside = sheet.items.find((i) => i.id.startsWith("web:send."));
  assert.ok(outside && parseSave({ itemId: outside.id, forms: { one: "א" } }));
  // The key terms moved to their own page: the full sheet no longer takes them.
  assert.equal(sheet.terms.length, 0);
});

test("placeholders are compared as a set", () => {
  assert.deepEqual(placeholders("{{count}} of {{ total }}"), ["count", "total"]);
  assert.deepEqual(placeholders("plain"), []);
  assert.deepEqual(placeholders("{n} days from {sender}"), ["n", "sender"]);
});

test("every line is in the sheet once, with plural forms on one line", () => {
  const ids = new Set(sheet.items.map((i) => i.id));
  assert.equal(ids.size, sheet.items.length);
  const keys = sheet.items.flatMap((i) => i.keys);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(sheet.items.some((i) => i.forms.length > 1));
});

test("the spreadsheet opens as Hebrew and quotes what needs quoting", () => {
  const edits = new Map<string, ReviewEdit>([
    [first.id, { item_id: first.id, forms: JSON.stringify({ [first.forms[0].form]: 'שורה, עם "מירכאות"' }), note: "הערה", status: "changed", updated_at: 0 }],
  ]);
  const csv = toCsv(edits);
  assert.ok(csv.startsWith("﻿Line,Section,Page"));
  assert.ok(csv.includes('"שורה, עם ""מירכאות"""'));
  const rows = csv.trim().split("\r\n").length;
  assert.equal(rows, 1 + sheet.terms.length + sheet.items.reduce((s, i) => s + i.forms.length, 0));
  const json = JSON.parse(toJson(edits));
  assert.equal(json.lines.length, 1);
  assert.equal(json.lines[0].forms[0].new, 'שורה, עם "מירכאות"');
  assert.deepEqual(json.lines[0].keys, first.keys);
});

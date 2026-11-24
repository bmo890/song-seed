import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTermSave, termsCsv, termsJson, termsSheet, type TermEdit } from "../../review/termsLib.ts";

test("the terms sheet has words in every group, and sentences", () => {
  assert.ok(termsSheet.rows.length >= 100);
  for (const g of termsSheet.groups) assert.ok(termsSheet.rows.some((r) => r.group === g.id), g.id);
  assert.ok(termsSheet.rows.every((r) => r.he && r.en));
  assert.ok(termsSheet.sentences.length >= 20);
});

test("a save must name a known row and stay short", () => {
  const id = termsSheet.rows[0].id;
  assert.deepEqual(parseTermSave({ itemId: id, text: " קליפ ", note: "n", status: "changed" }), { itemId: id, text: "קליפ", note: "n", status: "changed" });
  assert.equal(parseTermSave({ itemId: "term:nope", text: "x" }), null);
  assert.equal(parseTermSave({ itemId: id, text: "x".repeat(2001) }), null);
  assert.equal(parseTermSave({ itemId: id, status: "weird" })?.status, "");
});

test("exports carry his word, his Fine and his note", () => {
  const [a, b] = termsSheet.rows;
  const edits = new Map<string, TermEdit>([
    [a.id, { item_id: a.id, forms: JSON.stringify({ "": "קליפ" }), note: "", status: "changed", updated_at: 0 }],
    [b.id, { item_id: b.id, forms: "{}", note: "ok as is", status: "ok", updated_at: 0 }],
  ]);
  const csv = termsCsv(edits).split("\r\n");
  assert.ok(csv[1].includes("קליפ"));
  assert.ok(csv[2].includes(",yes,") && csv[2].includes("ok as is"));
  const json = JSON.parse(termsJson(edits));
  assert.equal(json.review, "he-terms");
  assert.equal(json.words.length, 2);
  assert.equal(json.words[0].new, "קליפ");
});

// Lightweight assertions runnable with `node --test` (no framework dep).
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeKind, normalizeShareKind, SHARE_KINDS } from "../shareKind.ts";

test("every app ShareKind is accepted as itself", () => {
  for (const kind of SHARE_KINDS) {
    assert.equal(normalizeShareKind(kind), kind);
  }
});

test("unknown, missing or malformed kinds read as clips — never refused", () => {
  assert.equal(normalizeShareKind(undefined), "clips");
  assert.equal(normalizeShareKind(null), "clips");
  assert.equal(normalizeShareKind("stems"), "clips");
  assert.equal(normalizeShareKind(42), "clips");
  assert.equal(normalizeShareKind({ kind: "workspace" }), "clips");
});

test("the recipient page names every package kind, and nothing for loose files", () => {
  assert.equal(describeKind("clips"), null);
  for (const kind of SHARE_KINDS.filter((k) => k !== "clips")) {
    assert.ok(describeKind(kind), `${kind} needs a description`);
  }
  assert.equal(describeKind("workspace"), "a whole workspace");
  assert.equal(describeKind("collection"), "a collection");
});

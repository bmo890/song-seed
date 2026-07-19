// Lightweight assertions runnable with `node --test` (no framework dep).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUploadAllowed, looksLikeZip, requiresZipMagic } from "../contentPolicy.ts";

test("accepts audio by extension + mime", () => {
  assert.equal(checkUploadAllowed("bass.m4a", "audio/mp4").ok, true);
  assert.equal(checkUploadAllowed("idea.wav", "audio/wav").ok, true);
  assert.equal(checkUploadAllowed("rough.mp3", "application/octet-stream").ok, true);
});

test("accepts .songnook with archive mime only", () => {
  assert.equal(checkUploadAllowed("Set.songnook", "application/octet-stream").ok, true);
  assert.equal(checkUploadAllowed("Set.songnook", "application/zip").ok, true);
  assert.equal(checkUploadAllowed("Set.songnook", "video/mp4").ok, false);
});

test("rejects video, office docs, executables, bare zips", () => {
  for (const [name, mime] of [
    ["clip.mp4", "video/mp4"],
    ["movie.mov", "video/quicktime"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["doc.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["a.pdf", "application/pdf"],
    ["tool.exe", "application/octet-stream"],
    ["bundle.zip", "application/zip"],
  ] as const) {
    assert.equal(checkUploadAllowed(name, mime).ok, false, `${name} should be rejected`);
  }
});

test("a video renamed with an audio mime is caught by extension", () => {
  assert.equal(checkUploadAllowed("clip.mp4", "audio/mp4").ok, false);
});

test("zip magic + requiresZipMagic", () => {
  assert.equal(requiresZipMagic("Set.songnook"), true);
  assert.equal(requiresZipMagic("bass.m4a"), false);
  assert.equal(looksLikeZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])), true);
  assert.equal(looksLikeZip(new Uint8Array([0x00, 0x01, 0x02, 0x03])), false);
  assert.equal(looksLikeZip(new Uint8Array([0x50, 0x4b])), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { attachmentDisposition, jsonResponse } from "../http.ts";

test("ASCII names keep a plain filename and an identical filename*", () => {
  assert.equal(
    attachmentDisposition("bass line.m4a"),
    `attachment; filename="bass line.m4a"; filename*=UTF-8''bass%20line.m4a`
  );
});

test("a Hebrew name ships as RFC 5987 UTF-8 with an ASCII fallback", () => {
  const header = attachmentDisposition("שיר חדש.m4a");
  assert.equal(header, `attachment; filename="_ _.m4a"; filename*=UTF-8''%D7%A9%D7%99%D7%A8%20%D7%97%D7%93%D7%A9.m4a`);
  // The header value must be Latin-1 representable — this is what Headers.set enforces.
  assert.ok(/^[\x20-\x7e]*$/.test(header));
});

test("a name with no ASCII letters at all falls back to 'file'", () => {
  assert.equal(
    attachmentDisposition("שיר"),
    `attachment; filename="file"; filename*=UTF-8''%D7%A9%D7%99%D7%A8`
  );
});

test("quotes, line breaks and backslashes never break the header", () => {
  const header = attachmentDisposition('a"b\r\nc\\d.wav');
  assert.equal(header, `attachment; filename="a_b__c_d.wav"; filename*=UTF-8''a_b__c_d.wav`);
});

test("RFC 5987 attr-char: *'() are percent-encoded in filename*", () => {
  assert.equal(
    attachmentDisposition("take (1)'*.wav"),
    `attachment; filename="take (1)'*.wav"; filename*=UTF-8''take%20%281%29%27%2A.wav`
  );
});

test("JSON responses carry nosniff", () => {
  assert.equal(jsonResponse({ ok: true }).headers.get("x-content-type-options"), "nosniff");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv } from "node:crypto";
import { SEAL_JS } from "../../pages/sealJs.ts";

// Run the page's own script in Node: it only needs WebCrypto, Blob and atob/btoa.
const win: any = { crypto: globalThis.crypto };
new Function("window", "btoa", "atob", "Blob", "TextEncoder", "TextDecoder", SEAL_JS)(
  win,
  btoa,
  atob,
  Blob,
  TextEncoder,
  TextDecoder
);
const Seal = win.SongNookSeal;
const R = Seal.RECORD as number;

const key = Uint8Array.from({ length: 32 }, (_, i) => i);
const prefix = Uint8Array.from([7, 6, 5, 4, 3, 2, 1]);
const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + 7) & 0xff);

/** SNS1 written out independently with Node's own AES-GCM: the known answer
 *  the browser code (and later the app's native code) must match. */
function reference(plain: Uint8Array): Uint8Array {
  const header = Buffer.alloc(15);
  header.write("SNS1", 0, "latin1");
  header.writeUInt32BE(R, 4);
  Buffer.from(prefix).copy(header, 8);
  const count = Math.max(1, Math.ceil(plain.length / R));
  const parts: Buffer[] = [header];
  for (let i = 0; i < count; i++) {
    const nonce = Buffer.alloc(12);
    Buffer.from(prefix).copy(nonce, 0);
    nonce.writeUInt32BE(i, 7);
    nonce[11] = i === count - 1 ? 1 : 0;
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(header);
    parts.push(cipher.update(plain.subarray(i * R, (i + 1) * R)), cipher.final(), cipher.getAuthTag());
  }
  return new Uint8Array(Buffer.concat(parts));
}

test("sealing matches the written-out format, byte for byte", async () => {
  for (const n of [0, 5, R, R + 1, 3 * R - 2]) {
    const plain = bytes(n);
    const sealed: Uint8Array = await Seal.sealBytes(key, plain, prefix);
    assert.deepEqual(sealed, reference(plain), `size ${n}`);
    assert.equal(sealed.length, Seal.sealedSize(n));
  }
});

test("what is sealed opens to the same bytes, at every record boundary", async () => {
  for (const n of [0, 1, R - 1, R, R + 1, 2 * R, 2 * R + 17]) {
    const plain = bytes(n);
    assert.deepEqual(await Seal.openBytes(key, await Seal.sealBytes(key, plain)), plain, `size ${n}`);
  }
});

test("a blob seals and opens record by record", async () => {
  const plain = bytes(2 * R + 100);
  const sealed: Blob = await Seal.sealBlob(key, new Blob([plain]));
  const opened: Blob = await Seal.openBlob(key, sealed, "audio/mp4");
  assert.equal(opened.type, "audio/mp4");
  assert.deepEqual(new Uint8Array(await opened.arrayBuffer()), plain);
});

test("a wrong key, a changed byte, a cut, a dropped or swapped record all refuse", async () => {
  const sealed: Uint8Array = await Seal.sealBytes(key, bytes(3 * R));
  const other = Uint8Array.from({ length: 32 }, () => 9);
  await assert.rejects(Seal.openBytes(other, sealed));

  const flipped = sealed.slice();
  flipped[20] ^= 1;
  await assert.rejects(Seal.openBytes(key, flipped));

  const step = R + 16;
  await assert.rejects(Seal.openBytes(key, sealed.slice(0, 15 + 2 * step)), "last record dropped");
  await assert.rejects(Seal.openBytes(key, sealed.slice(0, sealed.length - 1)), "cut short");

  const swapped = new Uint8Array(sealed.length);
  swapped.set(sealed.subarray(0, 15));
  swapped.set(sealed.subarray(15 + step, 15 + 2 * step), 15);
  swapped.set(sealed.subarray(15, 15 + step), 15 + step);
  swapped.set(sealed.subarray(15 + 2 * step), 15 + 2 * step);
  await assert.rejects(Seal.openBytes(key, swapped), "records swapped");

  const headerChanged = sealed.slice();
  headerChanged[9] ^= 1;
  await assert.rejects(Seal.openBytes(key, headerChanged), "header is bound");
});

test("the envelope travels as sealed base64", async () => {
  const envelope = { v: 1, title: "Blue Hour", senderName: "Ben", message: "bridge first", items: [{ name: "Blue Hour.m4a", mime: "audio/mp4", size: 42 }] };
  const text: string = await Seal.sealJson(key, envelope);
  assert.ok(text.startsWith("U05TMQ"), "SNS1 in base64");
  assert.deepEqual(await Seal.openJson(key, text), envelope);
});

test("the key rides in the link's #k= part, and only a whole key counts", () => {
  const text: string = Seal.keyText(key);
  assert.equal(text.length, 43);
  assert.deepEqual(Seal.keyFromHash(`#k=${text}`), key);
  assert.deepEqual(Seal.keyFromHash(`#x=1&k=${text}`), key);
  assert.equal(Seal.keyFromHash(`#k=${text.slice(1)}`), null);
  assert.equal(Seal.keyFromHash(""), null);
});

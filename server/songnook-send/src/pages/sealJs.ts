/**
 * The SNS1 sealed format in the browser (docs/product-plan/send-e2e-encryption.md):
 * AES-256-GCM in the STREAM construction, 64 KiB records, the key carried
 * only in the link's `#k=` part. One source for the recipient page (opening)
 * and the web sender (sealing), and the reference the app's native code is
 * checked against (lib/__tests__/seal.test.ts runs this very string in Node).
 *
 * Defines `window.SongNookSeal`. Plain browser JS: WebCrypto, Blob, atob/btoa.
 */
export const SEAL_JS = `
(function(root){
  var R = 65536, HEADER = 15, TAG = 16;
  var subtle = root.crypto.subtle;

  function b64url(bytes){
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
  }
  function fromB64(text){
    var t = text.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '=';
    var s = atob(t), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function b64(bytes){
    var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function concat(parts){
    var n = 0; parts.forEach(function(p){ n += p.length; });
    var out = new Uint8Array(n), at = 0;
    parts.forEach(function(p){ out.set(p, at); at += p.length; });
    return out;
  }
  function importKey(raw){
    if (!raw || raw.length !== 32) throw new Error('a parcel key is 32 bytes');
    return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  function header(prefix, recordSize){
    var h = new Uint8Array(HEADER);
    h.set([0x53, 0x4E, 0x53, 0x31], 0);
    new DataView(h.buffer).setUint32(4, recordSize);
    h.set(prefix, 8);
    return h;
  }
  function nonce(prefix, index, last){
    var n = new Uint8Array(12);
    n.set(prefix, 0);
    new DataView(n.buffer).setUint32(7, index);
    n[11] = last ? 1 : 0;
    return n;
  }
  function records(plainSize){ return Math.max(1, Math.ceil(plainSize / R)); }

  // read(offset, length) -> Promise<Uint8Array>; returns the sealed pieces in order.
  async function seal(rawKey, size, read, onProgress, fixedPrefix){
    var key = await importKey(rawKey);
    var prefix = fixedPrefix || root.crypto.getRandomValues(new Uint8Array(7));
    var h = header(prefix, R), parts = [h], count = records(size);
    for (var i = 0; i < count; i++){
      var off = i * R, len = Math.min(R, size - off);
      var plain = await read(off, len);
      var ct = await subtle.encrypt({ name: 'AES-GCM', iv: nonce(prefix, i, i === count - 1), additionalData: h, tagLength: 128 }, key, plain);
      parts.push(new Uint8Array(ct));
      if (onProgress) onProgress(off + len, size);
    }
    return parts;
  }

  async function open(rawKey, size, read, onProgress){
    if (size < HEADER + TAG) throw new Error('sealed file is too short');
    var key = await importKey(rawKey);
    var h = await read(0, HEADER);
    if (h[0] !== 0x53 || h[1] !== 0x4E || h[2] !== 0x53 || h[3] !== 0x31) throw new Error('not a sealed file');
    var r = new DataView(h.buffer, h.byteOffset, HEADER).getUint32(4);
    if (r < 1 || r > 16 * 1024 * 1024) throw new Error('sealed file has a bad record size');
    var prefix = h.slice(8, 15), body = size - HEADER, step = r + TAG;
    var count = Math.max(1, Math.ceil(body / step)), lastLen = body - (count - 1) * step;
    if (lastLen < TAG) throw new Error('sealed file is cut short');
    var parts = [];
    for (var i = 0; i < count; i++){
      var last = i === count - 1, off = HEADER + i * step;
      var ct = await read(off, last ? lastLen : step);
      var pt = await subtle.decrypt({ name: 'AES-GCM', iv: nonce(prefix, i, last), additionalData: h, tagLength: 128 }, key, ct);
      parts.push(new Uint8Array(pt));
      if (onProgress) onProgress(off + ct.length - HEADER, body);
    }
    return parts;
  }

  function bytesReader(bytes){ return function(o, l){ return Promise.resolve(bytes.subarray(o, o + l)); }; }
  function blobReader(blob){
    return function(o, l){ return blob.slice(o, o + l).arrayBuffer().then(function(b){ return new Uint8Array(b); }); };
  }

  root.SongNookSeal = {
    RECORD: R,
    newKey: function(){ return root.crypto.getRandomValues(new Uint8Array(32)); },
    keyText: b64url,
    keyFromText: function(text){ var k = fromB64(text); if (k.length !== 32) throw new Error('bad key'); return k; },
    /** The key from a link's #k=…, or null. */
    keyFromHash: function(hash){
      var m = /(?:^#|[#&])k=([A-Za-z0-9_-]{43})(?:&|$)/.exec(hash || '');
      return m ? fromB64(m[1]) : null;
    },
    sealedSize: function(plainSize){ return HEADER + plainSize + TAG * records(plainSize); },
    sealBytes: async function(key, bytes, fixedPrefix){ return concat(await seal(key, bytes.length, bytesReader(bytes), null, fixedPrefix)); },
    openBytes: async function(key, bytes){ return concat(await open(key, bytes.length, bytesReader(bytes))); },
    /** A file or blob, sealed, as a Blob ready to upload. */
    sealBlob: async function(key, blob, onProgress){ return new Blob(await seal(key, blob.size, blobReader(blob), onProgress)); },
    /** A sealed blob, opened, typed for playing or saving. */
    openBlob: async function(key, blob, type, onProgress){ return new Blob(await open(key, blob.size, blobReader(blob), onProgress), { type: type || '' }); },
    /** The parcel's envelope (title, sender, note, file names) as sealed base64, and back. */
    sealJson: async function(key, value){
      var plain = new TextEncoder().encode(JSON.stringify(value));
      return b64(concat(await seal(key, plain.length, bytesReader(plain))));
    },
    openJson: async function(key, text){
      var sealed = fromB64(text);
      return JSON.parse(new TextDecoder().decode(concat(await open(key, sealed.length, bytesReader(sealed)))));
    }
  };
})(window);
`;

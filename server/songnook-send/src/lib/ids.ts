/**
 * Unguessable, URL-safe ids. 128 bits of CSPRNG entropy, base62-encoded.
 * The link IS the capability in v1, so ids must not be enumerable or short.
 */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function base62(bytes: Uint8Array): string {
  // Interpret the random bytes as a big-endian integer and base62-encode it.
  let out = "";
  const digits = Array.from(bytes);
  // Repeated division of the byte array (base 256) by 62.
  while (digits.some((d) => d !== 0)) {
    let remainder = 0;
    for (let i = 0; i < digits.length; i++) {
      const acc = remainder * 256 + digits[i];
      digits[i] = Math.floor(acc / 62);
      remainder = acc % 62;
    }
    out = ALPHABET[remainder] + out;
  }
  return out || "0";
}

function randomBase62(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base62(bytes).padStart(Math.ceil((byteLength * 8) / Math.log2(62)), "0");
}

export function newTransferId(): string {
  return `t_${randomBase62(16)}`; // 128-bit
}

export function newItemId(): string {
  return `i_${randomBase62(8)}`;
}

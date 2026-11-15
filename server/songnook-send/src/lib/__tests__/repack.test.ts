import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPACK_JS } from "../../pages/repackJs.ts";

// Run the page's own script in Node: it needs Blob, TextEncoder/Decoder and Response.
const win: any = { DecompressionStream: (globalThis as any).DecompressionStream };
new Function("window", "Blob", "TextEncoder", "TextDecoder", "Response", REPACK_JS)(win, Blob, TextEncoder, TextDecoder, Response);
const repack: (b: Blob) => Promise<{ blob: Blob; name: string } | null> = win.SongNookRepack;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A stored zip written the way the app writes a .songnook (UTF-8 names, method 0). */
function zip(files: Record<string, string>): Blob {
  const parts: Uint8Array[] = [], dir: Uint8Array[] = [];
  let at = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = new TextEncoder().encode(name), d = new TextEncoder().encode(text), crc = crc32(d);
    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true);
    l.setUint32(14, crc, true); l.setUint32(18, d.length, true); l.setUint32(22, d.length, true); l.setUint16(26, n.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true);
    c.setUint32(42, at, true);
    parts.push(new Uint8Array(l.buffer), n, d);
    dir.push(new Uint8Array(c.buffer), n);
    at += 30 + n.length + d.length;
  }
  const size = dir.reduce((s, p) => s + p.length, 0), count = Object.keys(files).length;
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, count, true); e.setUint16(10, count, true);
  e.setUint32(12, size, true); e.setUint32(16, at, true);
  return new Blob([...parts, ...dir, new Uint8Array(e.buffer)]);
}

/** What the system's own unzip makes of it: name → contents (and it tests the CRCs). */
async function unzip(b: Blob): Promise<Record<string, string>> {
  const path = join(mkdtempSync(join(tmpdir(), "repack-")), "out.zip");
  writeFileSync(path, Buffer.from(await b.arrayBuffer()));
  execFileSync("unzip", ["-tq", path]);
  const names = execFileSync("unzip", ["-Z1", path], { encoding: "utf8" }).trim().split("\n");
  return Object.fromEntries(names.map((n) => [n, execFileSync("unzip", ["-p", path, n], { encoding: "utf8" })]));
}

const W = "Band", C1 = "Band/Rehearsal 2", C2 = "Band/Rehearsal 3", S = `${C1}/Harbor Lights`;
const manifest = (kind: string, title: string) => ({
  share: { kind, title },
  workspaces: [
    {
      folderPath: W,
      collections: [
        {
          folderPath: C1,
          songs: [
            {
              folderPath: S,
              clips: [
                {
                  audioPath: `${S}/Take 1.m4a`,
                  sourceAudioPath: `${S}/Take 1 Source.m4a`,
                  overdub: {
                    renderedMixPath: `${S}/Take 1 Mix.m4a`,
                    stems: [{ audioPath: `${S}/Take 1 Overdubs/Bass.m4a` }],
                  },
                },
                { audioPath: `${S}/Take 2.m4a` },
              ],
            },
          ],
          standaloneClips: [],
        },
        {
          folderPath: C2,
          songs: [],
          standaloneClips: [
            {
              audioPath: `${C2}/Riff.m4a`,
              takes: [{ audioPath: `${C2}/Riff.m4a` }, { audioPath: `${C2}/Riff Takes/Riff 2.m4a` }],
            },
          ],
        },
      ],
    },
  ],
});
const files = (m: object) => ({
  "manifest.json": JSON.stringify(m),
  [`${S}/song.json`]: "{}",
  [`${S}/Lyrics.txt`]: "la la",
  [`${S}/Take 1.m4a`]: "take one",
  [`${S}/Take 1 Source.m4a`]: "original",
  [`${S}/Take 1 Mix.m4a`]: "mix",
  [`${S}/Take 1 Overdubs/Bass.m4a`]: "bass",
  [`${S}/Take 2.m4a`]: "take two",
  [`${C2}/Riff.m4a`]: "riff",
  [`${C2}/Riff Takes/Riff 2.m4a`]: "riff two",
});

test("a workspace opens on its folder, collections inside, audio only", async () => {
  const out = await repack(zip(files(manifest("workspace", "Band"))));
  assert.ok(out);
  assert.equal(out.name, "Band");
  assert.deepEqual(await unzip(out.blob), {
    "Band/Rehearsal 2/Harbor Lights/Take 1.m4a": "take one",
    "Band/Rehearsal 2/Harbor Lights/Take 1 Mix.m4a": "mix",
    "Band/Rehearsal 2/Harbor Lights/Take 1 Layers/Bass.m4a": "bass",
    "Band/Rehearsal 2/Harbor Lights/Take 2.m4a": "take two",
    "Band/Rehearsal 3/Riff.m4a": "riff",
    "Band/Rehearsal 3/Riff Takes/Riff 2.m4a": "riff two",
  });
});

test("a sketch opens on its own folder, every take inside", async () => {
  const out = await repack(zip(files(manifest("sketch", "Harbor Lights"))));
  const got = Object.keys(await unzip(out!.blob)).filter((n) => n.startsWith("Harbor Lights/"));
  assert.deepEqual(got.sort(), [
    "Harbor Lights/Take 1 Layers/Bass.m4a",
    "Harbor Lights/Take 1 Mix.m4a",
    "Harbor Lights/Take 1.m4a",
    "Harbor Lights/Take 2.m4a",
  ]);
});

test("a collection opens on the collection, not the workspace", async () => {
  const names = Object.keys(await unzip((await repack(zip(files(manifest("collection", "Rehearsal 2")))))!.blob));
  assert.ok(names.every((n) => n.startsWith("Rehearsal 2/") || n.startsWith("Rehearsal 3/")), names.join());
});

test("anything that isn't a readable package resolves null", async () => {
  assert.equal(await repack(new Blob(["not a zip at all"])), null);
  assert.equal(await repack(zip({ "a.m4a": "x" })), null);
});

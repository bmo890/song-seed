jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readDirectoryAsync: jest.fn(async () => []),
  makeDirectoryAsync: jest.fn(async () => {}),
  downloadAsync: jest.fn(async () => ({ status: 200 })),
  deleteAsync: jest.fn(async () => {}),
}));

import { drawMagpiePage, magpieCoverSources } from "../magpieStash";

// Founder, 2026-11-18: keep pages ready on the phone so a broken request still
// opens a page, covers on disk, and no book shown twice.

const lines = Array.from({ length: 60 }, (_, i) => `line ${i} of the river and the lamps.`).join("\n");
let online = true;
let requests = 0;

function response(status: number, body: string, headers: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
  } as unknown as Response;
}

beforeAll(() => {
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    requests++;
    if (!online) throw new TypeError("Network request failed");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (headers.Range === "bytes=0-1") return response(206, "ab", { "content-range": "bytes 0-1/500000" });
    return response(206, lines, {});
  }) as unknown as typeof fetch;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function untilQuiet() {
  for (let i = 0; i < 200; i++) {
    const before = requests;
    await settle();
    if (requests === before) await settle();
    if (requests === before) return;
  }
}

test("pages kept ready open a new book without the network, and books don't repeat", async () => {
  const first = await drawMagpiePage({ language: "pt", book: null }, "book");
  await untilQuiet(); // five pages fill behind it

  const shown = [first.book.id];
  online = false;
  for (let i = 0; i < 5; i++) {
    const page = await drawMagpiePage({ language: "pt", book: null }, "book");
    expect(page.pageText).toContain("river");
    shown.push(page.book.id);
  }
  expect(new Set(shown).size).toBe(6);
  // The covers of every book drawn were saved, and the saved copy reads first.
  expect(magpieCoverSources(first.book)[0]).toBe(`file:///docs/magpie-covers/gutenberg-${first.book.id}.jpg`);

  // Ready pages used up and still offline: the failure shows.
  await expect(drawMagpiePage({ language: "pt", book: null }, "book")).rejects.toMatchObject({ kind: "offline" });
  online = true;
});

test("a new page of the same book is read live, and a failed one falls back to a ready page", async () => {
  const opened = await drawMagpiePage({ language: "de", book: null }, "book");
  await untilQuiet();
  const again = await drawMagpiePage({ language: "de", book: opened.book }, "page");
  expect(again.book.id).toBe(opened.book.id);

  online = false;
  const fallback = await drawMagpiePage({ language: "de", book: opened.book }, "page");
  expect(fallback.book.id).not.toBe(opened.book.id);
  online = true;
});

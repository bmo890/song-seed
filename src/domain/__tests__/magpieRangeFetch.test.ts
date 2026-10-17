import { fetchPassage, rangeHeaders } from "../magpie";
import type { MagpieBook } from "../../types";

// 2026-10-17: iOS and Android ask for gzip by default, and gutenberg.org answers
// a gzip range request with the whole compressed book (200, no Content-Range),
// so every English page failed. Range reads must ask for identity encoding.

const book: MagpieBook = {
  id: "203",
  title: "Uncle Tom's Cabin",
  author: "Harriet Beecher Stowe",
  textUrl: "https://www.gutenberg.org/cache/epub/203/pg203.txt",
  source: "gutenberg",
};

function response(status: number, body: string, headers: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
  } as unknown as Response;
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

test("range reads ask for identity encoding", () => {
  expect(rangeHeaders(10, 20)).toEqual({ Range: "bytes=10-20", "Accept-Encoding": "identity" });
});

test("every request in a page draw carries the identity header", async () => {
  const lines = Array.from({ length: 40 }, (_, i) => `line ${i} of the river and the lamps`).join("\n");
  const calls: Array<Record<string, string>> = [];
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push(headers);
    if (headers.Range === "bytes=0-1") {
      return response(206, "ab", { "content-range": "bytes 0-1/100000", "content-length": "2" });
    }
    return response(206, lines, {});
  }) as unknown as typeof fetch;

  const page = await fetchPassage(book);
  expect(page.length).toBeGreaterThan(0);
  expect(calls).toHaveLength(2);
  for (const headers of calls) expect(headers["Accept-Encoding"]).toBe("identity");
});

test("a server that ignores the range still yields one page, not the whole book", async () => {
  const whole = Array.from({ length: 4000 }, (_, i) => `sentence number ${i} in a long novel`).join("\n");
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (headers.Range === "bytes=0-1") {
      return response(206, "ab", { "content-range": `bytes 0-1/${whole.length}` });
    }
    return response(200, whole, {});
  }) as unknown as typeof fetch;

  const page = await fetchPassage(book);
  expect(page.length).toBeGreaterThan(0);
  expect(page.length).toBeLessThan(4000);
});

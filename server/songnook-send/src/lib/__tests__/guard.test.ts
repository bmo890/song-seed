import { test } from "node:test";
import assert from "node:assert/strict";
import { underRateLimit } from "../guard.ts";

const fakeLimiter = (success: boolean) => {
  const keys: string[] = [];
  return {
    keys,
    limiter: {
      async limit({ key }: { key: string }) {
        keys.push(key);
        return { success };
      },
    },
  };
};

const fakeKv = () => {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
    },
  };
};

test("the Rate Limiting binding decides when bound, keyed by IP and bucket", async () => {
  const create = fakeLimiter(true);
  const items = fakeLimiter(false);
  const env = { RATE_CREATE: create.limiter, RATE_ITEMS: items.limiter } as any;

  assert.equal(await underRateLimit(env, "create", "1.2.3.4", 30, 3600), true);
  assert.equal(await underRateLimit(env, "items", "1.2.3.4", 300, 3600), false);
  assert.deepEqual(create.keys, ["1.2.3.4"]);
  assert.deepEqual(items.keys, ["1.2.3.4"]);
});

test("the binding is preferred over the KV fallback, which is never touched", async () => {
  const { limiter } = fakeLimiter(false);
  const { kv, store } = fakeKv();
  const env = { RATE_CREATE: limiter, RATE: kv } as any;

  assert.equal(await underRateLimit(env, "create", "1.2.3.4", 30, 3600), false);
  assert.equal(store.size, 0);
});

test("KV fixed window counts up to the limit when no binding is present", async () => {
  const { kv } = fakeKv();
  const env = { RATE: kv } as any;

  assert.equal(await underRateLimit(env, "create", "1.2.3.4", 2, 3600), true);
  assert.equal(await underRateLimit(env, "create", "1.2.3.4", 2, 3600), true);
  assert.equal(await underRateLimit(env, "create", "1.2.3.4", 2, 3600), false);
  // Another IP and another bucket have their own counters.
  assert.equal(await underRateLimit(env, "create", "5.6.7.8", 2, 3600), true);
  assert.equal(await underRateLimit(env, "items", "1.2.3.4", 2, 3600), true);
});

test("fails open with neither a binding nor KV (local dev)", async () => {
  assert.equal(await underRateLimit({} as any, "create", "1.2.3.4", 0, 3600), true);
});

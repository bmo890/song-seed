import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  FREE_LINKS,
  browserLabel,
  newPairingCode,
  normalizeCode,
  proUntilFromSubscriber,
  senderAccess,
  type SenderRow,
} from "../access.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 1);

/** A D1 stand-in: COUNT answers `sent`, every write is recorded. */
const fakeEnv = (sent: number) => {
  const writes: unknown[][] = [];
  const DB = {
    prepare(sql: string) {
      let binds: unknown[] = [];
      return {
        bind(...b: unknown[]) {
          binds = b;
          return this;
        },
        async first() {
          return /COUNT/.test(sql) ? { n: sent } : null;
        },
        async run() {
          writes.push([sql, ...binds]);
          return { meta: { changes: 1 } };
        },
      };
    },
  };
  return { env: { DB } as any, writes };
};

const config = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    proForAll: false,
    revenueCatSecretKey: "sk_test",
    proEntitlementId: "songnook_pro",
    ...over,
  }) as any;

const sender = (over: Partial<SenderRow> = {}): SenderRow => ({
  sender_id: "s_1",
  created_at: NOW - 40 * DAY,
  rc_app_user_id: null,
  trial_ends_at: null,
  pro_until: null,
  pro_checked_at: null,
  ...over,
});

const rcAnswer = (entitlements: Record<string, unknown>) =>
  (async () => new Response(JSON.stringify({ subscriber: { entitlements } }))) as unknown as typeof fetch;
const rcDown = (async () => {
  throw new Error("offline");
}) as unknown as typeof fetch;

test("a pairing code is six symbols a person can't misread", () => {
  for (let i = 0; i < 200; i++) {
    const code = newPairingCode();
    assert.equal(code.length, CODE_LENGTH);
    for (const ch of code) assert.ok(CODE_ALPHABET.includes(ch), ch);
  }
  assert.ok(!/[IL O01]/.test(CODE_ALPHABET));
});

test("what a person types becomes the code", () => {
  assert.equal(normalizeCode(" k7m-4pq "), "K7M4PQ");
  assert.equal(normalizeCode(42), "");
});

test("a browser reads as its name and system", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const chromeWin = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
  const edge = chromeWin + " Edg/129.0";
  assert.equal(browserLabel(mac), "Safari on Mac");
  assert.equal(browserLabel(chromeWin), "Chrome on Windows");
  assert.equal(browserLabel(edge), "Edge on Windows");
  assert.equal(browserLabel(""), "Browser");
});

test("RevenueCat: absent is not Pro, lifetime never ends, grace counts", () => {
  assert.equal(proUntilFromSubscriber({ subscriber: { entitlements: {} } }, "songnook_pro"), 0);
  assert.equal(
    proUntilFromSubscriber({ subscriber: { entitlements: { songnook_pro: { expires_date: null } } } }, "songnook_pro"),
    Number.POSITIVE_INFINITY
  );
  const until = proUntilFromSubscriber(
    {
      subscriber: {
        entitlements: {
          songnook_pro: { expires_date: "2026-11-01T00:00:00Z", grace_period_expires_date: "2026-11-15T00:00:00Z" },
        },
      },
    },
    "songnook_pro"
  );
  assert.equal(until, Date.parse("2026-11-15T00:00:00Z"));
});

test("while nothing is for sale every sender is Pro", async () => {
  const { env } = fakeEnv(99);
  assert.deepEqual(await senderAccess(env, config({ proForAll: true }), sender(), NOW), {
    pro: true,
    freeLeft: FREE_LINKS,
  });
});

test("a free sender has three links per thirty days, then none", async () => {
  assert.deepEqual(await senderAccess(fakeEnv(1).env, config(), sender(), NOW), { pro: false, freeLeft: 2 });
  assert.deepEqual(await senderAccess(fakeEnv(3).env, config(), sender(), NOW), { pro: false, freeLeft: 0 });
});

test("the free month counts as Pro", async () => {
  const access = await senderAccess(fakeEnv(3).env, config(), sender({ trial_ends_at: NOW + DAY }), NOW);
  assert.equal(access.pro, true);
});

test("a subscriber is asked of RevenueCat once and the answer is kept", async () => {
  const { env, writes } = fakeEnv(3);
  const access = await senderAccess(
    env,
    config(),
    sender({ rc_app_user_id: "$RCAnonymousID:abc" }),
    NOW,
    rcAnswer({ songnook_pro: { expires_date: new Date(NOW + 30 * DAY).toISOString() } })
  );
  assert.equal(access.pro, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1], NOW + 30 * DAY);
});

test("a fresh cached answer is used without asking", async () => {
  let asked = false;
  const spy = (async () => {
    asked = true;
    return new Response("{}");
  }) as unknown as typeof fetch;
  const access = await senderAccess(
    fakeEnv(3).env,
    config(),
    sender({ rc_app_user_id: "x", pro_until: NOW + DAY, pro_checked_at: NOW - 60_000 }),
    NOW,
    spy
  );
  assert.equal(access.pro, true);
  assert.equal(asked, false);
});

test("RevenueCat down: a known payer keeps sending, a stranger stays free", async () => {
  const payer = sender({ rc_app_user_id: "x", pro_until: NOW + DAY, pro_checked_at: NOW - 7 * 60 * 60 * 1000 });
  assert.equal((await senderAccess(fakeEnv(3).env, config(), payer, NOW, rcDown)).pro, true);
  const stranger = sender({ rc_app_user_id: "y" });
  assert.equal((await senderAccess(fakeEnv(3).env, config(), stranger, NOW, rcDown)).pro, false);
});

test("a lapsed subscription is not Pro", async () => {
  const access = await senderAccess(
    fakeEnv(0).env,
    config(),
    sender({ rc_app_user_id: "x" }),
    NOW,
    rcAnswer({ songnook_pro: { expires_date: new Date(NOW - DAY).toISOString() } })
  );
  assert.deepEqual(access, { pro: false, freeLeft: 3 });
});

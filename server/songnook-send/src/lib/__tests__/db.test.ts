import { test } from "node:test";
import assert from "node:assert/strict";
import { insertItemWithinCaps } from "../db.ts";

/** A D1 stand-in that records the batched statements and answers with `changes`. */
const fakeDb = (insertChanges: number) => {
  const statements: { sql: string; binds: unknown[] }[] = [];
  const DB = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          statements.push({ sql, binds });
          return this;
        },
      };
    },
    async batch(stmts: unknown[]) {
      return stmts.map((_, i) => ({ meta: { changes: i === 0 ? insertChanges : 0 } }));
    },
  };
  return { statements, env: { DB } as any };
};

const item = {
  item_id: "it_1",
  transfer_id: "tr_1",
  file_name: "idea.m4a",
  mime_type: "audio/mp4",
  size: 1234,
  r2_key: "tr_1/it_1",
  download_count: 0,
  created_at: 1,
};

test("insert and size bump go in one batch, caps checked inside the INSERT", async () => {
  const { statements, env } = fakeDb(1);
  const landed = await insertItemWithinCaps(env, item, { maxTotalBytes: 1_000_000, maxItems: 200 });

  assert.equal(landed, true);
  assert.equal(statements.length, 2);
  const [insert, bump] = statements;
  assert.match(insert.sql, /INSERT INTO items/);
  assert.match(insert.sql, /status = 'draft'/);
  assert.match(insert.sql, /size_total \+ \?5 <= \?9/);
  assert.match(insert.sql, /COUNT\(\*\) FROM items WHERE transfer_id = \?2\) < \?10/);
  assert.deepEqual(insert.binds, [
    "it_1", "tr_1", "idea.m4a", "audio/mp4", 1234, "tr_1/it_1", 0, 1, 1_000_000, 200,
  ]);
  // The bump only follows a landed row.
  assert.match(bump.sql, /UPDATE transfers SET size_total = size_total \+ \?1/);
  assert.match(bump.sql, /EXISTS \(SELECT 1 FROM items WHERE item_id = \?3\)/);
  assert.deepEqual(bump.binds, [1234, "tr_1", "it_1"]);
});

test("reports false when the conditional INSERT changed nothing", async () => {
  const { env } = fakeDb(0);
  assert.equal(
    await insertItemWithinCaps(env, item, { maxTotalBytes: 1_000_000, maxItems: 200 }),
    false
  );
});

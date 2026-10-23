/**
 * Expiry sweep — deletes expired transfers' R2 objects and rows.
 * Runs nightly via cron (see wrangler.toml [triggers]).
 */
import type { Env } from "../env";
import { loadConfig } from "../env";
import { deleteTransfer, getItems, listExpired } from "./db";

const BATCH = 500;

export async function sweepExpired(
  env: Env,
  now: number
): Promise<{ transfers: number; objects: number; failed: number }> {
  const cfg = loadConfig(env);
  const staleDraftBefore = now - cfg.draftExpiryMs;
  let transfers = 0;
  let objects = 0;
  let failed = 0;

  // Page until a short batch comes back: one capped batch per night let a
  // backlog grow for good. A transfer that fails is logged and skipped, never
  // allowed to abort the night — it comes back in the next sweep.
  for (;;) {
    const expired = await listExpired(env, now, staleDraftBefore, BATCH);
    let removed = 0;
    for (const t of expired) {
      try {
        const items = await getItems(env, t.transfer_id);
        const keys = items.map((i) => i.r2_key);
        if (keys.length) {
          // R2 delete accepts an array of keys.
          await env.BUCKET.delete(keys);
          objects += keys.length;
        }
        await deleteTransfer(env, t.transfer_id);
        removed++;
      } catch (err) {
        failed++;
        console.error(`sweep: ${t.transfer_id} failed`, err);
      }
    }
    transfers += removed;
    // A full batch with no progress would return the same rows forever.
    if (expired.length < BATCH || removed === 0) break;
  }

  return { transfers, objects, failed };
}

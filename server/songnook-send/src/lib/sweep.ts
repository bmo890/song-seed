/**
 * Expiry sweep — deletes expired transfers' R2 objects and rows.
 * Runs nightly via cron (see wrangler.toml [triggers]).
 */
import type { Env } from "../env";
import { loadConfig } from "../env";
import { deleteTransfer, getItems, listExpired } from "./db";

export async function sweepExpired(env: Env, now: number): Promise<{ transfers: number; objects: number }> {
  const cfg = loadConfig(env);
  const expired = await listExpired(env, now, now - cfg.draftExpiryMs);
  let objects = 0;

  for (const t of expired) {
    const items = await getItems(env, t.transfer_id);
    const keys = items.map((i) => i.r2_key);
    if (keys.length) {
      // R2 delete accepts an array of keys.
      await env.BUCKET.delete(keys);
      objects += keys.length;
    }
    await deleteTransfer(env, t.transfer_id);
  }

  return { transfers: expired.length, objects };
}

/**
 * Thin typed helpers over D1. No ORM — the schema is two tables.
 */
import type { Env } from "../env";

export interface TransferRow {
  transfer_id: string;
  title: string;
  sender_name: string;
  sender_user_id: string | null;
  message: string;
  status: "draft" | "finalized";
  size_total: number;
  created_at: number;
  expires_at: number;
  upload_token_hash: string | null;
}

export interface ItemRow {
  item_id: string;
  transfer_id: string;
  file_name: string;
  mime_type: string;
  size: number;
  r2_key: string;
  download_count: number;
  created_at: number;
  sort_order: number;
}

export async function insertTransfer(env: Env, t: TransferRow): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO transfers
      (transfer_id, title, sender_name, sender_user_id, message, status, size_total, created_at, expires_at, upload_token_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      t.transfer_id,
      t.title,
      t.sender_name,
      t.sender_user_id,
      t.message,
      t.status,
      t.size_total,
      t.created_at,
      t.expires_at,
      t.upload_token_hash
    )
    .run();
}

export async function getTransfer(env: Env, id: string): Promise<TransferRow | null> {
  return await env.DB.prepare(`SELECT * FROM transfers WHERE transfer_id = ?`)
    .bind(id)
    .first<TransferRow>();
}

export async function getItems(env: Env, transferId: string): Promise<ItemRow[]> {
  const res = await env.DB.prepare(
    `SELECT * FROM items WHERE transfer_id = ? ORDER BY sort_order ASC, created_at ASC`
  )
    .bind(transferId)
    .all<ItemRow>();
  return res.results ?? [];
}

export async function getItem(env: Env, transferId: string, itemId: string): Promise<ItemRow | null> {
  return await env.DB.prepare(`SELECT * FROM items WHERE transfer_id = ? AND item_id = ?`)
    .bind(transferId, itemId)
    .first<ItemRow>();
}

export async function insertItem(env: Env, item: ItemRow): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO items
      (item_id, transfer_id, file_name, mime_type, size, r2_key, download_count, created_at, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      item.item_id,
      item.transfer_id,
      item.file_name,
      item.mime_type,
      item.size,
      item.r2_key,
      item.download_count,
      item.created_at,
      item.sort_order
    )
    .run();
}

export async function bumpTransferSize(env: Env, transferId: string, addBytes: number): Promise<void> {
  await env.DB.prepare(`UPDATE transfers SET size_total = size_total + ? WHERE transfer_id = ?`)
    .bind(addBytes, transferId)
    .run();
}

export async function setTransferSize(env: Env, transferId: string, sizeBytes: number): Promise<void> {
  await env.DB.prepare(`UPDATE transfers SET size_total = ? WHERE transfer_id = ?`)
    .bind(sizeBytes, transferId)
    .run();
}

export async function setItemSize(env: Env, itemId: string, sizeBytes: number): Promise<void> {
  await env.DB.prepare(`UPDATE items SET size = ? WHERE item_id = ?`)
    .bind(sizeBytes, itemId)
    .run();
}

export async function finalizeTransfer(env: Env, transferId: string): Promise<void> {
  await env.DB.prepare(`UPDATE transfers SET status = 'finalized' WHERE transfer_id = ?`)
    .bind(transferId)
    .run();
}

export async function incrementDownload(env: Env, itemId: string): Promise<void> {
  await env.DB.prepare(`UPDATE items SET download_count = download_count + 1 WHERE item_id = ?`)
    .bind(itemId)
    .run();
}

/** Rows whose expiry has passed, plus old unfinished drafts — for the sweep. */
export async function listExpired(
  env: Env,
  now: number,
  staleDraftBefore: number,
  limit = 500
): Promise<TransferRow[]> {
  const res = await env.DB.prepare(
    `SELECT * FROM transfers
     WHERE expires_at < ? OR (status = 'draft' AND created_at < ?)
     LIMIT ?`
  )
    .bind(now, staleDraftBefore, limit)
    .all<TransferRow>();
  return res.results ?? [];
}

export async function deleteTransfer(env: Env, transferId: string): Promise<void> {
  // items cascade via FK, but D1 needs PRAGMA foreign_keys; delete explicitly to be safe.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM items WHERE transfer_id = ?`).bind(transferId),
    env.DB.prepare(`DELETE FROM transfers WHERE transfer_id = ?`).bind(transferId),
  ]);
}

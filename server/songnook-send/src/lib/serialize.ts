/**
 * Build the transfer metadata payload — the wire contract in brief §3.
 * `sender.userId` is ALWAYS present and null in v1 (accounts fill it later, no wire change).
 */
import type { Config } from "../env";
import type { ItemRow, TransferRow } from "./db";
import { normalizeShareKind, type ShareKind } from "./shareKind";

export interface TransferItemPayload {
  itemId: string;
  fileName: string;
  size: number;
  mimeType: string;
  downloadUrl: string;
}

export interface TransferPayload {
  transferId: string;
  title: string;
  sender: { name: string; userId: string | null };
  message: string;
  /** What the sender said this is — loose files, a running order, a chart
   *  book, a collection or a whole workspace (lib/shareKind.ts). */
  kind: ShareKind;
  createdAt: string;
  expiresAt: string;
  items: TransferItemPayload[];
}

export function toTransferPayload(
  cfg: Config,
  transfer: TransferRow,
  items: ItemRow[]
): TransferPayload {
  return {
    transferId: transfer.transfer_id,
    title: transfer.title,
    sender: { name: transfer.sender_name, userId: transfer.sender_user_id ?? null },
    message: transfer.message,
    kind: normalizeShareKind(transfer.share_kind),
    createdAt: new Date(transfer.created_at).toISOString(),
    expiresAt: new Date(transfer.expires_at).toISOString(),
    items: items.map((it) => ({
      itemId: it.item_id,
      fileName: it.file_name,
      size: it.size,
      mimeType: it.mime_type,
      downloadUrl: `${cfg.publicOrigin}/t/${transfer.transfer_id}/dl/${it.item_id}`,
    })),
  };
}

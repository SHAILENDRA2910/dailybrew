import { getDb } from "@/lib/db";
import { nowISO } from "@/lib/utils";
import type { ReceiptRecord } from "@/types/domain";

/** Photos are compressed before they get here; this is a hard safety ceiling. */
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

export async function getReceipt(expenseId: string): Promise<ReceiptRecord | null> {
  if (!expenseId) return null;
  const db = await getDb();
  return (await db.get("receipts", expenseId)) ?? null;
}

export async function listReceipts(workspaceId: string): Promise<ReceiptRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex("receipts", "workspace", workspaceId);
}

export async function saveReceipt(
  workspaceId: string,
  expenseId: string,
  blob: Blob,
  mimeType: string,
): Promise<ReceiptRecord> {
  if (!blob.size) throw new Error("That photo is empty. Choose another image.");
  if (blob.size > MAX_RECEIPT_BYTES) {
    throw new Error("That photo is larger than 4 MB. Choose a smaller image.");
  }

  const db = await getDb();
  const expense = await db.get("transactions", expenseId);
  if (!expense || expense.workspace_id !== workspaceId) {
    throw new Error("That expense could not be found.");
  }

  const record: ReceiptRecord = {
    expense_id: expenseId,
    workspace_id: workspaceId,
    blob,
    mime_type: mimeType || blob.type || "image/jpeg",
    created_at: nowISO(),
  };
  await db.put("receipts", record);
  return record;
}

export async function deleteReceipt(expenseId: string): Promise<void> {
  const db = await getDb();
  await db.delete("receipts", expenseId);
}

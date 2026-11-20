import { getDb, META_KEYS } from "@/lib/db";
import { nowISO } from "@/lib/utils";
import type {
  Category,
  ImportBatch,
  Item,
  ItemPriceHistory,
  MonthClosure,
  MonthlyBudget,
  Profile,
  ReceiptRecord,
  Transaction,
  TransactionItem,
  Workspace,
} from "@/types/domain";

export interface BackupReceipt {
  expense_id: string;
  workspace_id: string;
  mime_type: string;
  created_at: string;
  data_url: string;
}

export interface BackupFile {
  app: "dailybrew";
  version: number;
  exported_at: string;
  data: {
    workspace: Workspace;
    profile: Profile | null;
    categories: Category[];
    items: Item[];
    transactions: Transaction[];
    transaction_items: TransactionItem[];
    monthly_budgets: MonthlyBudget[];
    item_price_history: ItemPriceHistory[];
    imports: ImportBatch[];
    month_closures: MonthClosure[];
    receipts: BackupReceipt[];
  };
}

export interface BackupSummary {
  workspaceName: string;
  exportedAt: string;
  entries: number;
  items: number;
  receipts: number;
  closures: number;
}

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowList(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    fail(`The backup is missing its ${label}.`);
  }
  return value.map((row, index) => {
    if (!isRecord(row)) fail(`Row ${index + 1} of ${label} is damaged.`);
    return row;
  });
}

function requireString(
  row: Record<string, unknown>,
  key: string,
  label: string,
  index: number,
): string {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) {
    fail(`Row ${index + 1} of ${label} is damaged (missing ${key}).`);
  }
  return value;
}

function requireNumber(
  row: Record<string, unknown>,
  key: string,
  label: string,
  index: number,
): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`Row ${index + 1} of ${label} is damaged (missing ${key}).`);
  }
  return value;
}

function validateWorkspaceRows<T>(
  value: unknown,
  label: string,
  required: readonly string[],
  workspaceId: string,
): T[] {
  const list = rowList(value, label);
  list.forEach((row, index) => {
    required.forEach((key) => requireString(row, key, label, index));
    if (row.workspace_id !== workspaceId) {
      fail(`The backup’s ${label} belong to a different workspace.`);
    }
  });
  return list as T[];
}

export function parseBackupFile(raw: unknown): BackupFile {
  if (!isRecord(raw) || raw.app !== "dailybrew") {
    fail("This file isn’t a DailyBrew backup.");
  }
  const data = raw.data;
  if (!isRecord(data)) fail("The backup is missing its workspace data.");
  if (
    !isRecord(data.workspace) ||
    typeof data.workspace.id !== "string" ||
    typeof data.workspace.name !== "string"
  ) {
    fail("The backup’s workspace details are missing.");
  }

  const workspace = data.workspace as unknown as Workspace;
  const workspaceId = workspace.id;

  const categories = validateWorkspaceRows<Category>(
    data.categories,
    "categories",
    ["id", "name", "workspace_id"],
    workspaceId,
  );
  const items = validateWorkspaceRows<Item>(
    data.items,
    "items",
    ["id", "name", "category_id", "workspace_id"],
    workspaceId,
  );
  rowList(data.items, "items").forEach((row, index) => {
    requireNumber(row, "default_rate", "items", index);
  });
  const transactions = validateWorkspaceRows<Transaction>(
    data.transactions,
    "expense entries",
    ["id", "expense_date", "workspace_id"],
    workspaceId,
  );
  transactions.forEach((transaction, index) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.expense_date)) {
      fail(`Expense entry ${index + 1} has a damaged date.`);
    }
  });
  const monthlyBudgets = validateWorkspaceRows<MonthlyBudget>(
    data.monthly_budgets,
    "budgets",
    ["id", "workspace_id"],
    workspaceId,
  );
  rowList(data.monthly_budgets, "budgets").forEach((row, index) => {
    requireNumber(row, "budget_amount", "budgets", index);
  });
  const priceHistory = validateWorkspaceRows<ItemPriceHistory>(
    data.item_price_history,
    "rate history",
    ["id", "item_id", "workspace_id"],
    workspaceId,
  );
  const imports = validateWorkspaceRows<ImportBatch>(
    data.imports,
    "import log",
    ["id", "workspace_id"],
    workspaceId,
  );
  const closures = validateWorkspaceRows<MonthClosure>(
    data.month_closures,
    "month closures",
    ["id", "month", "workspace_id"],
    workspaceId,
  );
  rowList(data.month_closures, "month closures").forEach((row, index) => {
    requireNumber(row, "closing_total", "month closures", index);
    requireNumber(row, "entry_count", "month closures", index);
  });

  const lineRows = rowList(data.transaction_items, "expense lines");
  lineRows.forEach((row, index) => {
    requireString(row, "id", "expense lines", index);
    requireString(row, "transaction_id", "expense lines", index);
    requireString(row, "item_id", "expense lines", index);
    requireNumber(row, "quantity", "expense lines", index);
    requireNumber(row, "unit_rate", "expense lines", index);
    requireNumber(row, "line_total", "expense lines", index);
  });

  const receiptRows = rowList(data.receipts, "receipt photos");
  receiptRows.forEach((row, index) => {
    requireString(row, "expense_id", "receipt photos", index);
    const dataUrl = requireString(row, "data_url", "receipt photos", index);
    if (!dataUrl.startsWith("data:image/")) {
      fail(`Receipt photo ${index + 1} is damaged.`);
    }
    if (row.workspace_id !== workspaceId) {
      fail("The backup’s receipt photos belong to a different workspace.");
    }
  });

  const transactionIds = new Set(transactions.map((transaction) => transaction.id));
  lineRows.forEach((row, index) => {
    if (!transactionIds.has(String(row.transaction_id))) {
      fail(`Expense line ${index + 1} points at a missing entry.`);
    }
  });

  const profile = data.profile && isRecord(data.profile) ? (data.profile as unknown as Profile) : null;
  if (profile) {
    if (typeof profile.id !== "string" || !profile.id.trim()) {
      fail("The backup’s profile is damaged.");
    }
    if (typeof profile.full_name !== "string") {
      fail("The backup’s profile is damaged.");
    }
  }

  return {
    app: "dailybrew",
    version: typeof raw.version === "number" ? raw.version : 1,
    exported_at: typeof raw.exported_at === "string" ? raw.exported_at : "",
    data: {
      workspace: {
        ...workspace,
        date_format: workspace.date_format === "medium" ? "medium" : "dmy",
      },
      profile,
      categories,
      items,
      transactions,
      transaction_items: lineRows as unknown as TransactionItem[],
      monthly_budgets: monthlyBudgets,
      item_price_history: priceHistory,
      imports,
      month_closures: closures,
      receipts: receiptRows as unknown as BackupReceipt[],
    },
  };
}

export function describeBackup(backup: BackupFile): BackupSummary {
  return {
    workspaceName: backup.data.workspace.name,
    exportedAt: backup.exported_at,
    entries: backup.data.transactions.length,
    items: backup.data.items.length,
    receipts: backup.data.receipts.length,
    closures: backup.data.month_closures.length,
  };
}

/** Avoids FileReader so it also works with blobs from any realm. */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("A receipt photo in the backup is damaged.");
  const mime = match[1] || "image/jpeg";
  if (match[2]) {
    const binary = atob(match[3] ?? "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(match[3] ?? "")], { type: mime });
}

export async function buildBackup(workspaceId: string): Promise<BackupFile> {
  const db = await getDb();
  const workspace = await db.get("workspaces", workspaceId);
  if (!workspace) throw new Error("Workspace not found.");

  const profileMeta = await db.get("meta", META_KEYS.profileId);
  const [profileRaw, categories, items, transactions, budgets, priceHistory, imports, closures, receipts] =
    await Promise.all([
      profileMeta ? db.get("profiles", profileMeta.value) : Promise.resolve(null),
      db.getAllFromIndex("categories", "workspace", workspaceId),
      db.getAllFromIndex("items", "workspace", workspaceId),
      db.getAllFromIndex("transactions", "workspace", workspaceId),
      db.getAllFromIndex("monthly_budgets", "workspace", workspaceId),
      db.getAllFromIndex("item_price_history", "workspace", workspaceId),
      db.getAllFromIndex("imports", "workspace", workspaceId),
      db.getAllFromIndex("month_closures", "workspace", workspaceId),
      db.getAllFromIndex("receipts", "workspace", workspaceId),
    ]);

  const transactionIds = new Set(transactions.map((transaction) => transaction.id));
  const transactionItems = (await db.getAll("transaction_items")).filter((line) =>
    transactionIds.has(line.transaction_id),
  );

  const receiptRows: BackupReceipt[] = await Promise.all(
    receipts.map(async (receipt) => ({
      expense_id: receipt.expense_id,
      workspace_id: receipt.workspace_id,
      mime_type: receipt.mime_type,
      created_at: receipt.created_at,
      data_url: await blobToDataUrl(receipt.blob),
    })),
  );

  return {
    app: "dailybrew",
    version: 2,
    exported_at: nowISO(),
    data: {
      workspace: { ...workspace, date_format: workspace.date_format ?? "dmy" },
      profile: profileRaw ?? null,
      categories,
      items,
      transactions,
      transaction_items: transactionItems,
      monthly_budgets: budgets,
      item_price_history: priceHistory,
      imports,
      month_closures: closures,
      receipts: receiptRows,
    },
  };
}

/**
 * Replaces the whole local workspace with a validated backup. Every row is
 * checked before the write transaction starts, so a damaged file never wipes
 * existing data.
 */
export async function restoreBackup(backup: BackupFile): Promise<Workspace> {
  const { data } = backup;
  const receipts: ReceiptRecord[] = await Promise.all(
    data.receipts.map(async (receipt) => ({
      expense_id: receipt.expense_id,
      workspace_id: receipt.workspace_id,
      blob: await dataUrlToBlob(receipt.data_url),
      mime_type: receipt.mime_type || "image/jpeg",
      created_at: receipt.created_at || nowISO(),
    })),
  );

  const db = await getDb();
  const tx = db.transaction(
    [
      "workspaces",
      "profiles",
      "categories",
      "items",
      "transactions",
      "transaction_items",
      "monthly_budgets",
      "item_price_history",
      "imports",
      "month_closures",
      "receipts",
      "meta",
    ],
    "readwrite",
  );

  await Promise.all([
    tx.objectStore("workspaces").clear(),
    tx.objectStore("profiles").clear(),
    tx.objectStore("categories").clear(),
    tx.objectStore("items").clear(),
    tx.objectStore("transactions").clear(),
    tx.objectStore("transaction_items").clear(),
    tx.objectStore("monthly_budgets").clear(),
    tx.objectStore("item_price_history").clear(),
    tx.objectStore("imports").clear(),
    tx.objectStore("month_closures").clear(),
    tx.objectStore("receipts").clear(),
    tx.objectStore("meta").clear(),
  ]);

  const writes: Promise<unknown>[] = [
    tx.objectStore("workspaces").put(data.workspace),
    ...data.categories.map((category) => tx.objectStore("categories").put(category)),
    ...data.items.map((item) => tx.objectStore("items").put(item)),
    ...data.transactions.map((transaction) => tx.objectStore("transactions").put(transaction)),
    ...data.transaction_items.map((line) => tx.objectStore("transaction_items").put(line)),
    ...data.monthly_budgets.map((budget) => tx.objectStore("monthly_budgets").put(budget)),
    ...data.item_price_history.map((entry) => tx.objectStore("item_price_history").put(entry)),
    ...data.imports.map((batch) => tx.objectStore("imports").put(batch)),
    ...data.month_closures.map((closure) => tx.objectStore("month_closures").put(closure)),
    ...receipts.map((receipt) => tx.objectStore("receipts").put(receipt)),
  ];

  if (data.profile) {
    writes.push(tx.objectStore("profiles").put(data.profile));
  }
  writes.push(
    tx.objectStore("meta").put({ key: META_KEYS.workspaceId, value: data.workspace.id }),
    tx.objectStore("meta").put({ key: META_KEYS.onboardedAt, value: nowISO() }),
  );
  if (data.profile) {
    writes.push(
      tx.objectStore("meta").put({ key: META_KEYS.profileId, value: data.profile.id }),
    );
  }

  await Promise.all(writes);
  await tx.done;
  return data.workspace;
}

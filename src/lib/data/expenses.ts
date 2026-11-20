import { MAX_QUANTITY } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { assertMonthsOpen } from "@/lib/data/closures";
import { inferCategoryName, inferUnit } from "@/lib/seed";
import { todayISO } from "@/lib/dates";
import { newId, nowISO } from "@/lib/utils";
import type {
  Category,
  Expense,
  ExpenseInput,
  ImportBatch,
  ImportCommitResult,
  Item,
  Transaction,
  TransactionItem,
} from "@/types/domain";

export function expenseTotal(expense: Expense): number {
  return expense.items.reduce((total, line) => total + line.line_total, 0);
}

export function expenseQuantity(expense: Expense): number {
  return expense.items.reduce((total, line) => total + line.quantity, 0);
}

function sortExpenses(left: Expense, right: Expense): number {
  const dateOrder = right.expense_date.localeCompare(left.expense_date);
  if (dateOrder !== 0) return dateOrder;
  return right.created_at.localeCompare(left.created_at);
}

export async function listExpenses(workspaceId: string): Promise<Expense[]> {
  const db = await getDb();
  const [transactions, transactionItems] = await Promise.all([
    db.getAllFromIndex("transactions", "workspace", workspaceId),
    db.getAll("transaction_items"),
  ]);

  const ids = new Set(transactions.map((transaction) => transaction.id));
  const byTransaction = new Map<string, TransactionItem[]>();
  for (const line of transactionItems) {
    if (!ids.has(line.transaction_id)) continue;
    const bucket = byTransaction.get(line.transaction_id) ?? [];
    bucket.push(line);
    byTransaction.set(line.transaction_id, bucket);
  }

  return transactions
    .map((transaction) => ({
      ...transaction,
      items: (byTransaction.get(transaction.id) ?? []).sort((left, right) =>
        left.created_at.localeCompare(right.created_at),
      ),
    }))
    .sort(sortExpenses);
}

export async function getExpense(id: string): Promise<Expense | null> {
  const db = await getDb();
  const transaction = await db.get("transactions", id);
  if (!transaction) return null;
  const items = await db.getAllFromIndex("transaction_items", "transaction", id);
  return { ...transaction, items };
}

async function resolveLines(
  workspaceId: string,
  input: ExpenseInput,
  createdAt: string,
): Promise<{ expense: Omit<Transaction, "id">; lines: TransactionItem[]; itemCount: number }> {
  const db = await getDb();
  if (!input.items.length) throw new Error("Add at least one item.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate)) {
    throw new Error("Choose a valid expense date.");
  }

  const itemRecords = await Promise.all(
    input.items.map(async (line) => {
      const item = await db.get("items", line.itemId);
      if (!item || item.workspace_id !== workspaceId) {
        throw new Error("One of the selected items is no longer available.");
      }
      const quantity = Math.round(line.quantity);
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        throw new Error("Each quantity must be between 1 and 999.");
      }
      if (!Number.isFinite(line.unitRate) || line.unitRate < 0) {
        throw new Error("Each rate must be zero or greater.");
      }
      return { item, quantity, unitRate: Math.round(line.unitRate) };
    }),
  );

  const expense = {
    workspace_id: workspaceId,
    expense_date: input.expenseDate,
    note: input.note.trim(),
    created_by: "",
    created_at: createdAt,
    updated_at: createdAt,
  };

  const lines: TransactionItem[] = itemRecords.map(({ item, quantity, unitRate }) => ({
    id: newId(),
    transaction_id: "",
    item_id: item.id,
    item_name_snapshot: item.name,
    quantity,
    unit_rate: unitRate,
    line_total: Math.round(quantity * unitRate),
    created_at: createdAt,
  }));

  return { expense, lines, itemCount: itemRecords.length };
}

export async function createExpense(
  workspaceId: string,
  profileId: string,
  input: ExpenseInput,
): Promise<Expense> {
  const db = await getDb();
  const createdAt = nowISO();
  await assertMonthsOpen(workspaceId, [input.expenseDate]);
  const prepared = await resolveLines(workspaceId, input, createdAt);
  const transaction: Transaction = {
    ...prepared.expense,
    id: newId(),
    created_by: profileId,
  };
  const lines = prepared.lines.map((line) => ({ ...line, transaction_id: transaction.id }));

  const tx = db.transaction(["transactions", "transaction_items"], "readwrite");
  await Promise.all([
    tx.objectStore("transactions").put(transaction),
    ...lines.map((line) => tx.objectStore("transaction_items").put(line)),
  ]);
  await tx.done;

  return { ...transaction, items: lines };
}

export async function updateExpense(
  workspaceId: string,
  expenseId: string,
  input: ExpenseInput,
): Promise<Expense> {
  const db = await getDb();
  const current = await db.get("transactions", expenseId);
  if (!current || current.workspace_id !== workspaceId) throw new Error("Expense not found.");
  await assertMonthsOpen(workspaceId, [current.expense_date, input.expenseDate]);

  const updatedAt = nowISO();
  const prepared = await resolveLines(workspaceId, input, updatedAt);
  const transaction: Transaction = {
    ...current,
    expense_date: input.expenseDate,
    note: input.note.trim(),
    updated_at: updatedAt,
  };
  const oldLines = await db.getAllFromIndex("transaction_items", "transaction", expenseId);
  const lines = prepared.lines.map((line) => ({ ...line, transaction_id: expenseId }));

  const tx = db.transaction(["transactions", "transaction_items"], "readwrite");
  await Promise.all([
    ...oldLines.map((line) => tx.objectStore("transaction_items").delete(line.id)),
    tx.objectStore("transactions").put(transaction),
  ]);
  await Promise.all(lines.map((line) => tx.objectStore("transaction_items").put(line)));
  await tx.done;

  return { ...transaction, items: lines };
}

export async function deleteExpense(expenseId: string): Promise<Expense> {
  const db = await getDb();
  const transaction = await db.get("transactions", expenseId);
  if (!transaction) throw new Error("Expense not found.");
  await assertMonthsOpen(transaction.workspace_id, [transaction.expense_date]);
  const lines = await db.getAllFromIndex("transaction_items", "transaction", expenseId);

  const tx = db.transaction(["transactions", "transaction_items"], "readwrite");
  await Promise.all([
    ...lines.map((line) => tx.objectStore("transaction_items").delete(line.id)),
    tx.objectStore("transactions").delete(expenseId),
  ]);
  await tx.done;

  return { ...transaction, items: lines };
}

/** Used by the undo toast after a delete. */
export async function restoreExpense(expense: Expense): Promise<void> {
  await assertMonthsOpen(expense.workspace_id, [expense.expense_date]);
  const db = await getDb();
  const tx = db.transaction(["transactions", "transaction_items"], "readwrite");
  await Promise.all([
    tx.objectStore("transactions").put(expense),
    ...expense.items.map((line) => tx.objectStore("transaction_items").put(line)),
  ]);
  await tx.done;
}

export async function getExistingFingerprints(workspaceId: string): Promise<Set<string>> {
  const db = await getDb();
  const transactions = await db.getAllFromIndex("transactions", "workspace", workspaceId);
  return new Set(
    transactions
      .map((transaction) => transaction.import_fingerprint)
      .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
  );
}

export interface ImportCommitRow {
  expenseDate: string;
  itemName: string;
  categoryName: string;
  quantity: number;
  unitRate: number;
  fingerprint: string;
}

export interface ImportCommitOptions {
  fileName: string;
  rejectedCount: number;
}

/**
 * Imports accepted rows as one transaction per workbook row. Item names and
 * rates are snapshotted per line; current catalogue prices are never rewritten.
 * Rows are skipped by import fingerprint when the same workbook is imported twice.
 */
export async function commitImportRows(
  workspaceId: string,
  profileId: string,
  rows: ImportCommitRow[],
  options: ImportCommitOptions,
): Promise<ImportCommitResult> {
  const db = await getDb();
  await assertMonthsOpen(
    workspaceId,
    rows.map((row) => row.expenseDate),
  );
  const [categories, items, existingFingerprints] = await Promise.all([
    db.getAllFromIndex("categories", "workspace", workspaceId),
    db.getAllFromIndex("items", "workspace", workspaceId),
    getExistingFingerprints(workspaceId),
  ]);

  const categoryByName = new Map(
    categories.map((category) => [category.name.trim().toLowerCase(), category]),
  );
  const itemByName = new Map(items.map((item) => [item.name.trim().toLowerCase(), item]));
  const newCategories: Category[] = [];
  const newItems: Item[] = [];
  const seenFingerprints = new Set<string>();
  const transactions: Transaction[] = [];
  const transactionItems: TransactionItem[] = [];
  const importedAt = nowISO();
  let skippedDuplicates = 0;

  for (const row of rows) {
    if (
      !row.fingerprint ||
      existingFingerprints.has(row.fingerprint) ||
      seenFingerprints.has(row.fingerprint)
    ) {
      skippedDuplicates += 1;
      continue;
    }
    seenFingerprints.add(row.fingerprint);

    const categoryName = inferCategoryName(row.itemName, row.categoryName);
    let category = categoryByName.get(categoryName.toLowerCase());
    if (!category) {
      category = {
        id: newId(),
        workspace_id: workspaceId,
        name: categoryName,
        is_active: true,
        created_at: importedAt,
      };
      categoryByName.set(categoryName.toLowerCase(), category);
      newCategories.push(category);
    }

    let item = itemByName.get(row.itemName.trim().toLowerCase());
    if (!item) {
      item = {
        id: newId(),
        workspace_id: workspaceId,
        category_id: category.id,
        name: row.itemName.trim(),
        default_rate: Math.round(row.unitRate),
        unit: inferUnit(categoryName),
        is_active: true,
        created_at: importedAt,
        updated_at: importedAt,
      };
      itemByName.set(item.name.toLowerCase(), item);
      newItems.push(item);
    }

    const transaction: Transaction = {
      id: newId(),
      workspace_id: workspaceId,
      expense_date: row.expenseDate,
      note: "",
      created_by: profileId,
      created_at: importedAt,
      updated_at: importedAt,
      import_fingerprint: row.fingerprint,
      import_source: options.fileName,
    };
    const line: TransactionItem = {
      id: newId(),
      transaction_id: transaction.id,
      item_id: item.id,
      item_name_snapshot: row.itemName.trim(),
      quantity: Math.round(row.quantity),
      unit_rate: Math.round(row.unitRate),
      line_total: Math.round(row.quantity * row.unitRate),
      created_at: importedAt,
    };
    transactions.push(transaction);
    transactionItems.push(line);
  }

  const importBatch: ImportBatch = {
    id: newId(),
    workspace_id: workspaceId,
    file_name: options.fileName,
    imported_at: importedAt,
    imported_count: transactions.length,
    skipped_count: skippedDuplicates,
    rejected_count: options.rejectedCount,
  };

  const tx = db.transaction(
    ["categories", "items", "transactions", "transaction_items", "imports"],
    "readwrite",
  );
  await Promise.all([
    ...newCategories.map((category) => tx.objectStore("categories").put(category)),
    ...newItems.map((item) => tx.objectStore("items").put(item)),
    ...transactions.map((transaction) => tx.objectStore("transactions").put(transaction)),
    ...transactionItems.map((line) => tx.objectStore("transaction_items").put(line)),
    tx.objectStore("imports").put(importBatch),
  ]);
  await tx.done;

  return {
    imported: transactions.length,
    skippedDuplicates,
    rejected: options.rejectedCount,
    itemsCreated: newItems.length,
    categoriesCreated: newCategories.length,
  };
}

export { todayISO };

import { getDb } from "@/lib/db";
import { monthLabel } from "@/lib/dates";
import { newId, nowISO } from "@/lib/utils";
import type { MonthClosure } from "@/types/domain";

const MONTH_KEY = /^\d{4}-\d{2}$/;

export async function listClosures(workspaceId: string): Promise<MonthClosure[]> {
  const db = await getDb();
  const closures = await db.getAllFromIndex("month_closures", "workspace", workspaceId);
  return closures.sort((left, right) => right.month.localeCompare(left.month));
}

export async function getClosure(
  workspaceId: string,
  month: string,
): Promise<MonthClosure | null> {
  const closures = await listClosures(workspaceId);
  return closures.find((closure) => closure.month === month) ?? null;
}

/**
 * Blocks writes that would alter a closed month. Called by every expense
 * mutation and by imports so a locked month cannot change by any route.
 */
export async function assertMonthsOpen(
  workspaceId: string,
  dates: string[],
): Promise<void> {
  const months = [...new Set(dates.filter(Boolean).map((date) => date.slice(0, 7)))];
  if (months.length === 0) return;
  const closures = await listClosures(workspaceId);
  const closed = new Set(closures.map((closure) => closure.month));
  const blocked = months.find((month) => closed.has(month));
  if (blocked) {
    throw new Error(
      `${monthLabel(blocked)} is closed. Reopen it from Reports → Month-end close before changing expenses.`,
    );
  }
}

export async function closeMonth(
  workspaceId: string,
  month: string,
): Promise<MonthClosure> {
  if (!MONTH_KEY.test(month)) throw new Error("Choose a valid month to close.");
  const existing = await getClosure(workspaceId, month);
  if (existing) return existing;

  const db = await getDb();
  const transactions = (
    await db.getAllFromIndex("transactions", "workspace", workspaceId)
  ).filter((transaction) => transaction.expense_date.slice(0, 7) === month);
  if (transactions.length === 0) {
    throw new Error(`There are no expenses in ${monthLabel(month)} to close.`);
  }

  const ids = new Set(transactions.map((transaction) => transaction.id));
  const lines = await db.getAll("transaction_items");
  const closingTotal = lines.reduce(
    (total, line) => (ids.has(line.transaction_id) ? total + line.line_total : total),
    0,
  );

  const closure: MonthClosure = {
    id: newId(),
    workspace_id: workspaceId,
    month,
    closed_at: nowISO(),
    closing_total: closingTotal,
    entry_count: transactions.length,
  };
  await db.put("month_closures", closure);
  return closure;
}

export async function reopenMonth(workspaceId: string, month: string): Promise<void> {
  const closure = await getClosure(workspaceId, month);
  if (!closure) return;
  const db = await getDb();
  await db.delete("month_closures", closure.id);
}

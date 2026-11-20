import { getDb } from "@/lib/db";
import { newId, nowISO } from "@/lib/utils";
import type { BudgetInput, MonthlyBudget } from "@/types/domain";

export async function listBudgets(workspaceId: string): Promise<MonthlyBudget[]> {
  const db = await getDb();
  const budgets = await db.getAllFromIndex("monthly_budgets", "workspace", workspaceId);
  return budgets.sort(
    (left, right) => right.year - left.year || right.month - left.month,
  );
}

export async function getBudgetForMonth(
  workspaceId: string,
  year: number,
  month: number,
): Promise<MonthlyBudget | null> {
  const db = await getDb();
  const budgets = await db.getAllFromIndex("monthly_budgets", "workspace", workspaceId);
  return budgets.find((budget) => budget.year === year && budget.month === month) ?? null;
}

export async function saveBudget(
  workspaceId: string,
  input: BudgetInput,
): Promise<MonthlyBudget> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a budget greater than zero.");
  }
  if (input.month < 1 || input.month > 12) throw new Error("Choose a valid month.");
  const db = await getDb();
  const existing = await getBudgetForMonth(workspaceId, input.year, input.month);
  const updatedAt = nowISO();
  const budget: MonthlyBudget = existing
    ? {
        ...existing,
        budget_amount: Math.round(input.amount),
        updated_at: updatedAt,
      }
    : {
        id: newId(),
        workspace_id: workspaceId,
        year: input.year,
        month: input.month,
        budget_amount: Math.round(input.amount),
        created_at: updatedAt,
        updated_at: updatedAt,
      };
  await db.put("monthly_budgets", budget);
  return budget;
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const db = await getDb();
  await db.delete("monthly_budgets", budgetId);
}

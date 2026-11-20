import { eachDate, monthKeyFromISO } from "@/lib/dates";
import type { Category, Expense, Item } from "@/types/domain";

export interface LineView {
  lineId: string;
  expenseId: string;
  date: string;
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  unitRate: number;
  amount: number;
  note: string;
}

export interface Totals {
  amount: number;
  quantity: number;
  entries: number;
  lines: number;
}

export interface DateGroup {
  date: string;
  total: number;
  quantity: number;
  entries: number;
  expenses: Expense[];
}

export interface ItemSummary {
  key: string;
  itemId: string;
  name: string;
  categoryName: string;
  quantity: number;
  amount: number;
  occurrences: number;
}

export interface CategorySummary {
  name: string;
  amount: number;
  quantity: number;
  lines: number;
  percentage: number;
}

export interface DailyPoint {
  date: string;
  amount: number;
  quantity: number;
}

export interface ComparisonItem {
  key: string;
  name: string;
  categoryName: string;
  currentQuantity: number;
  previousQuantity: number;
  currentAmount: number;
  previousAmount: number;
}

export interface BudgetStatus {
  hasBudget: boolean;
  budget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  barPercent: number;
  tone: "none" | "on-track" | "warning" | "over";
}

export function flattenExpenses(
  expenses: Expense[],
  items: Item[],
  categories: Category[],
): LineView[] {
  const categoryIdByItem = new Map(items.map((item) => [item.id, item.category_id]));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  return expenses.flatMap((expense) =>
    expense.items.map((line) => {
      const categoryId = categoryIdByItem.get(line.item_id) ?? "";
      return {
        lineId: line.id,
        expenseId: expense.id,
        date: expense.expense_date,
        itemId: line.item_id,
        itemName: line.item_name_snapshot,
        categoryId,
        categoryName: categoryNameById.get(categoryId) ?? "Other",
        quantity: line.quantity,
        unitRate: line.unit_rate,
        amount: line.line_total,
        note: expense.note,
      };
    }),
  );
}

export function totalsFromLines(lines: LineView[], entries = 0): Totals {
  return {
    amount: lines.reduce((total, line) => total + line.amount, 0),
    quantity: lines.reduce((total, line) => total + line.quantity, 0),
    entries,
    lines: lines.length,
  };
}

export function expensesInRange(expenses: Expense[], from: string, to: string): Expense[] {
  return expenses.filter(
    (expense) => expense.expense_date >= from && expense.expense_date <= to,
  );
}

export function expensesInMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter((expense) => monthKeyFromISO(expense.expense_date) === month);
}

export function activeMonthKeys(expenses: Expense[]): string[] {
  return [...new Set(expenses.map((expense) => monthKeyFromISO(expense.expense_date)))].sort(
    (left, right) => right.localeCompare(left),
  );
}

export function groupExpensesByDate(expenses: Expense[]): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  for (const expense of expenses) {
    const existing = groups.get(expense.expense_date) ?? {
      date: expense.expense_date,
      total: 0,
      quantity: 0,
      entries: 0,
      expenses: [],
    };
    existing.expenses.push(expense);
    existing.total += expense.items.reduce((total, line) => total + line.line_total, 0);
    existing.quantity += expense.items.reduce((total, line) => total + line.quantity, 0);
    existing.entries += 1;
    groups.set(expense.expense_date, existing);
  }
  return [...groups.values()].sort((left, right) => right.date.localeCompare(left.date));
}

export function buildDailySeries(lines: LineView[], from: string, to: string): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  for (const date of eachDate(from, to)) {
    byDate.set(date, { date, amount: 0, quantity: 0 });
  }
  for (const line of lines) {
    const point = byDate.get(line.date);
    if (!point) continue;
    point.amount += line.amount;
    point.quantity += line.quantity;
  }
  return [...byDate.values()];
}

export function itemBreakdown(lines: LineView[]): ItemSummary[] {
  const items = new Map<string, ItemSummary>();
  for (const line of lines) {
    const key = line.itemId || line.itemName.toLowerCase();
    const existing = items.get(key) ?? {
      key,
      itemId: line.itemId,
      name: line.itemName,
      categoryName: line.categoryName,
      quantity: 0,
      amount: 0,
      occurrences: 0,
    };
    existing.quantity += line.quantity;
    existing.amount += line.amount;
    existing.occurrences += 1;
    items.set(key, existing);
  }
  return [...items.values()].sort((left, right) => right.amount - left.amount);
}

export function categoryBreakdown(lines: LineView[]): CategorySummary[] {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const categories = new Map<string, CategorySummary>();
  for (const line of lines) {
    const existing = categories.get(line.categoryName) ?? {
      name: line.categoryName,
      amount: 0,
      quantity: 0,
      lines: 0,
      percentage: 0,
    };
    existing.amount += line.amount;
    existing.quantity += line.quantity;
    existing.lines += 1;
    categories.set(line.categoryName, existing);
  }
  return [...categories.values()]
    .map((category) => ({
      ...category,
      percentage: total > 0 ? Math.round((category.amount / total) * 100) : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function activeDayCount(lines: LineView[]): number {
  return new Set(lines.map((line) => line.date)).size;
}

export function averagePerActiveDay(lines: LineView[]): number {
  const days = activeDayCount(lines);
  if (days === 0) return 0;
  return Math.round(lines.reduce((total, line) => total + line.amount, 0) / days);
}

export function topByQuantity(lines: LineView[]): ItemSummary | null {
  return (
    [...itemBreakdown(lines)].sort(
      (left, right) => right.quantity - left.quantity || right.amount - left.amount,
    )[0] ?? null
  );
}

export function topByAmount(lines: LineView[]): ItemSummary | null {
  return itemBreakdown(lines)[0] ?? null;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function budgetStatus(spent: number, budget: number): BudgetStatus {
  if (!budget || budget <= 0) {
    return {
      hasBudget: false,
      budget: 0,
      spent,
      remaining: 0,
      percentUsed: 0,
      barPercent: 0,
      tone: "none",
    };
  }
  const percentUsed = Math.round((spent / budget) * 100);
  const tone = spent > budget ? "over" : percentUsed >= 80 ? "warning" : "on-track";
  return {
    hasBudget: true,
    budget,
    spent,
    remaining: budget - spent,
    percentUsed,
    barPercent: Math.min(100, Math.max(0, percentUsed)),
    tone,
  };
}

export function itemFrequency(expenses: Expense[]): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const expense of expenses) {
    for (const line of expense.items) {
      frequency.set(line.item_id, (frequency.get(line.item_id) ?? 0) + 1);
    }
  }
  return frequency;
}

export function compareItemConsumption(
  current: LineView[],
  previous: LineView[],
): ComparisonItem[] {
  const map = new Map<string, ComparisonItem>();
  const upsert = (line: LineView, side: "current" | "previous") => {
    const key = line.itemName.trim().toLowerCase();
    const entry = map.get(key) ?? {
      key,
      name: line.itemName,
      categoryName: line.categoryName,
      currentQuantity: 0,
      previousQuantity: 0,
      currentAmount: 0,
      previousAmount: 0,
    };
    if (side === "current") {
      entry.currentQuantity += line.quantity;
      entry.currentAmount += line.amount;
    } else {
      entry.previousQuantity += line.quantity;
      entry.previousAmount += line.amount;
    }
    map.set(key, entry);
  };
  current.forEach((line) => upsert(line, "current"));
  previous.forEach((line) => upsert(line, "previous"));
  return [...map.values()].sort(
    (left, right) =>
      right.currentAmount - left.currentAmount || right.previousAmount - left.previousAmount,
  );
}

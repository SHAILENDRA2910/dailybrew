import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  categoryBreakdown,
  flattenExpenses,
  groupExpensesByDate,
  itemFrequency,
  percentChange,
  totalsFromLines,
} from "@/lib/analytics";
import type { Category, Expense, Item } from "@/types/domain";

const workspaceId = "w1";

const categories: Category[] = [
  { id: "tea", workspace_id: workspaceId, name: "Tea", is_active: true, created_at: "2026-08-01" },
  { id: "coffee", workspace_id: workspaceId, name: "Coffee", is_active: true, created_at: "2026-08-01" },
];

const items: Item[] = [
  {
    id: "i1",
    workspace_id: workspaceId,
    category_id: "tea",
    name: "Tea Medium",
    default_rate: 1800,
    unit: "cup",
    is_active: true,
    created_at: "2026-08-01",
    updated_at: "2026-08-01",
  },
  {
    id: "i2",
    workspace_id: workspaceId,
    category_id: "coffee",
    name: "Black Coffee",
    default_rate: 2000,
    unit: "cup",
    is_active: true,
    created_at: "2026-08-01",
    updated_at: "2026-08-01",
  },
];

function expense(
  id: string,
  date: string,
  itemId: string,
  name: string,
  quantity: number,
  rate: number,
): Expense {
  return {
    id,
    workspace_id: workspaceId,
    expense_date: date,
    note: "",
    created_by: "p1",
    created_at: `${date}T10:00:00.000Z`,
    updated_at: `${date}T10:00:00.000Z`,
    items: [
      {
        id: `${id}-line`,
        transaction_id: id,
        item_id: itemId,
        item_name_snapshot: name,
        quantity,
        unit_rate: rate,
        line_total: quantity * rate,
        created_at: `${date}T10:00:00.000Z`,
      },
    ],
  };
}

const expenses: Expense[] = [
  expense("t1", "2026-11-19", "i1", "Tea Medium", 3, 1800),
  expense("t2", "2026-11-19", "i2", "Black Coffee", 2, 2000),
  expense("t3", "2026-11-18", "i1", "Tea Medium", 1, 1800),
];

describe("expense analytics", () => {
  const lines = flattenExpenses(expenses, items, categories);

  it("flattens saved snapshots with their categories", () => {
    expect(lines).toHaveLength(3);
    expect(lines[0]?.categoryName).toBe("Tea");
    expect(lines[1]?.categoryName).toBe("Coffee");
  });

  it("sums amounts, quantities and entries from real records", () => {
    const totals = totalsFromLines(lines, expenses.length);
    expect(totals.amount).toBe(5400 + 4000 + 1800);
    expect(totals.quantity).toBe(6);
    expect(totals.entries).toBe(3);
    expect(totals.lines).toBe(3);
  });

  it("groups transactions by date with daily totals", () => {
    const groups = groupExpensesByDate(expenses);
    expect(groups[0]?.date).toBe("2026-11-19");
    expect(groups[0]?.total).toBe(9400);
    expect(groups[1]?.total).toBe(1800);
  });

  it("calculates category percentages", () => {
    const categoriesInView = categoryBreakdown(lines);
    expect(categoriesInView.find((category) => category.name === "Tea")?.amount).toBe(7200);
    expect(categoriesInView.reduce((total, category) => total + category.percentage, 0)).toBe(100);
  });

  it("counts item frequency for quick entry ordering", () => {
    const frequency = itemFrequency(expenses);
    expect(frequency.get("i1")).toBe(2);
    expect(frequency.get("i2")).toBe(1);
  });

  it("handles month-on-month changes and missing baselines", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });

  it("describes budget utilisation with warning thresholds", () => {
    expect(budgetStatus(0, 0).hasBudget).toBe(false);
    expect(budgetStatus(5000, 10000).tone).toBe("on-track");
    expect(budgetStatus(8500, 10000).tone).toBe("warning");
    expect(budgetStatus(11000, 10000).tone).toBe("over");
    expect(budgetStatus(11000, 10000).remaining).toBe(-1000);
  });
});

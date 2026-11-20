import { categoryTheme } from "@/lib/category-meta";
import type { Category, Expense, Item } from "@/types/domain";

export interface ExpenseLineRow {
  lineId: string;
  expenseId: string;
  expense: Expense;
  date: string;
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  quantity: number;
  unitRate: number;
  amount: number;
  note: string;
}

export function buildExpenseLineRows(
  expenses: Expense[],
  items: Item[],
  categories: Category[],
): ExpenseLineRow[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return expenses.flatMap((expense) =>
    expense.items.map((line) => {
      const item = itemById.get(line.item_id);
      const category = item ? categoryById.get(item.category_id) : undefined;
      const categoryName = category?.name ?? "Other";
      return {
        lineId: line.id,
        expenseId: expense.id,
        expense,
        date: expense.expense_date,
        itemId: line.item_id,
        itemName: line.item_name_snapshot,
        categoryId: category?.id ?? "",
        categoryName,
        categoryColor: categoryTheme(categoryName).hex,
        quantity: line.quantity,
        unitRate: line.unit_rate,
        amount: line.line_total,
        note: expense.note,
      };
    }),
  );
}

export function expenseTotal(expense: Expense): number {
  return expense.items.reduce((total, line) => total + line.line_total, 0);
}

export function expenseQuantity(expense: Expense): number {
  return expense.items.reduce((total, line) => total + line.quantity, 0);
}

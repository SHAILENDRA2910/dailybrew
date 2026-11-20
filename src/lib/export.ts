import { format } from "date-fns";
import * as XLSX from "xlsx";
import { flattenExpenses } from "@/lib/analytics";
import { formatDateMedium, formatDateTime, monthLabel, parseDateOnly } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Category, Expense, Item } from "@/types/domain";

export interface ExportResult {
  fileName: string;
  rows: number;
  amount: number;
}

function exportRows(
  expenses: Expense[],
  items: Item[],
  categories: Category[],
): (string | number)[][] {
  const lines = flattenExpenses(expenses, items, categories).sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder !== 0) return dateOrder;
    return left.itemName.localeCompare(right.itemName);
  });

  return lines.map((line) => [
    line.date,
    line.itemName,
    line.categoryName,
    line.quantity,
    line.unitRate / 100,
    line.amount / 100,
    format(parseDateOnly(line.date), "MMMM"),
    line.note,
  ]);
}

function headerRow(currency: string): (string | number)[] {
  return [
    "Date",
    "Item",
    "Category",
    "Quantity",
    `Rate (${currency})`,
    `Total Amount (${currency})`,
    "Month",
    "Note",
  ];
}

function exportSummary(
  expenses: Expense[],
  items: Item[],
  categories: Category[],
): { entries: number; lines: number; quantity: number; amount: number } {
  const lines = flattenExpenses(expenses, items, categories);
  return {
    entries: expenses.length,
    lines: lines.length,
    quantity: lines.reduce((total, line) => total + line.quantity, 0),
    amount: lines.reduce((total, line) => total + line.amount, 0),
  };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function makeSheet(
  expenses: Expense[],
  items: Item[],
  categories: Category[],
  currency: string,
): XLSX.WorkSheet {
  const rows = [
    headerRow(currency),
    ...exportRows(expenses, items, categories),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
    { wch: 26 },
  ];
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  return sheet;
}

export function exportCsv(
  expenses: Expense[],
  items: Item[],
  categories: Category[],
  currency: string,
  fileName: string,
): ExportResult {
  const sheet = makeSheet(expenses, items, categories, currency);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }), fileName);
  const summary = exportSummary(expenses, items, categories);
  return { fileName, rows: summary.lines, amount: summary.amount };
}

export function exportExcel(
  expenses: Expense[],
  items: Item[],
  categories: Category[],
  currency: string,
  fileName: string,
): ExportResult {
  const workbook = XLSX.utils.book_new();
  const sheet = makeSheet(expenses, items, categories, currency);
  XLSX.utils.book_append_sheet(workbook, sheet, "Expenses");

  const summary = exportSummary(expenses, items, categories);
  const dates = expenses.map((expense) => expense.expense_date).sort();
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["DailyBrew expense export"],
    [
      "Range",
      dates.length
        ? `${formatDateMedium(dates[0] ?? "")} – ${formatDateMedium(dates[dates.length - 1] ?? "")}`
        : "No entries",
    ],
    ["Entries", summary.entries],
    ["Item lines", summary.lines],
    ["Total quantity", summary.quantity],
    ["Total amount", formatMoney(summary.amount, { currency })],
    ["Generated", formatDateTime(new Date().toISOString())],
  ]);
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  XLSX.writeFile(workbook, fileName, { compression: true });
  return { fileName, rows: summary.lines, amount: summary.amount };
}

export function suggestedFileName(
  scope: { type: "month"; month: string } | { type: "range"; from: string; to: string } | { type: "all" },
  extension: "csv" | "xlsx",
): string {
  if (scope.type === "month") return `dailybrew-${scope.month}.${extension}`;
  if (scope.type === "range") return `dailybrew-${scope.from}_to_${scope.to}.${extension}`;
  return `dailybrew-all-${format(new Date(), "yyyy-MM-dd")}.${extension}`;
}

export function buildExportContextLabel(
  scope: { type: "month"; month: string } | { type: "range"; from: string; to: string } | { type: "all" },
): string {
  if (scope.type === "month") return monthLabel(scope.month);
  if (scope.type === "range") return `${formatDateMedium(scope.from)} – ${formatDateMedium(scope.to)}`;
  return "All time";
}

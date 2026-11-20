import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { DateField } from "@/components/shared/date-field";
import { SegmentedControl, type SegmentedOption } from "@/components/shared/segmented-control";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useExpenses, useItems } from "@/hooks/queries";
import { activeMonthKeys, expensesInMonth, expensesInRange, flattenExpenses } from "@/lib/analytics";
import {
  buildExportContextLabel,
  exportCsv,
  exportExcel,
  suggestedFileName,
} from "@/lib/export";
import {
  currentMonthKey,
  formatDateMedium,
  monthLabel,
} from "@/lib/dates";
import { formatMoney, formatQuantity } from "@/lib/money";
import type { Expense } from "@/types/domain";

type ScopeType = "month" | "range" | "all";
type ExportScopeArg =
  | { type: "month"; month: string }
  | { type: "range"; from: string; to: string }
  | { type: "all" };

const scopeOptions: SegmentedOption<ScopeType>[] = [
  { value: "month", label: "Month" },
  { value: "range", label: "Date range" },
  { value: "all", label: "All time" },
];

export function ExportPanel() {
  const { workspace, currency } = useWorkspaceContext();
  const { data: expenses = [] } = useExpenses(workspace.id);
  const { data: items = [] } = useItems(workspace.id);
  const { data: categories = [] } = useCategories(workspace.id);

  const [scopeType, setScopeType] = useState<ScopeType>("all");
  const [month, setMonth] = useState(currentMonthKey());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const monthChoices = useMemo(() => {
    const set = new Set(activeMonthKeys(expenses));
    set.add(currentMonthKey());
    set.add(month);
    return [...set].sort((left, right) => right.localeCompare(left));
  }, [expenses, month]);

  const rangeError =
    scopeType === "range"
      ? !from || !to
        ? "Choose both a start and an end date."
        : from > to
          ? "The start date must come before the end date."
          : null
      : null;

  const scoped = useMemo<Expense[]>(() => {
    if (scopeType === "month") return expensesInMonth(expenses, month);
    if (scopeType === "range") {
      if (!from || !to || from > to) return [];
      return expensesInRange(expenses, from, to);
    }
    return expenses;
  }, [expenses, scopeType, month, from, to]);

  const summary = useMemo(() => {
    const lines = flattenExpenses(scoped, items, categories);
    return {
      entries: scoped.length,
      lines: lines.length,
      quantity: lines.reduce((total, line) => total + line.quantity, 0),
      amount: lines.reduce((total, line) => total + line.amount, 0),
    };
  }, [scoped, items, categories]);

  const scopeArg: ExportScopeArg =
    scopeType === "month"
      ? { type: "month", month }
      : scopeType === "range"
        ? { type: "range", from, to }
        : { type: "all" };

  const disabled = scoped.length === 0 || Boolean(rangeError);

  const handleCsv = () => {
    try {
      const result = exportCsv(
        scoped,
        items,
        categories,
        currency,
        suggestedFileName(scopeArg, "csv"),
      );
      toast.success(`CSV ready · ${result.rows} item lines.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The CSV could not be created.");
    }
  };

  const handleExcel = () => {
    try {
      const result = exportExcel(
        scoped,
        items,
        categories,
        currency,
        suggestedFileName(scopeArg, "xlsx"),
      );
      toast.success(`Excel workbook ready · ${result.rows} item lines.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workbook could not be created.");
    }
  };

  const handlePdf = () => {
    if (scopeType === "range" && (!from || !to || from > to)) return;
    const params = new URLSearchParams({ print: "1" });
    if (scopeType === "month") params.set("month", month);
    if (scopeType === "range") {
      params.set("from", from);
      params.set("to", to);
    }
    const url = `${window.location.origin}/print?${params.toString()}`;
    // `noopener` makes window.open return null, which would falsely report a
    // blocked pop-up. Open normally, then sever the opener relationship.
    const opened = window.open(url, "_blank");
    if (opened) {
      opened.opener = null;
    } else {
      toast.error("Your browser blocked the print view. Allow pop-ups and try again.");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-espresso">What should we export?</h2>
            <p className="mt-0.5 text-[11.5px] text-mocha">
              Every format uses item name and rate snapshots from the saved entry.
            </p>
          </div>
          <SegmentedControl
            options={scopeOptions}
            value={scopeType}
            onChange={setScopeType}
            ariaLabel="Export scope"
            className="sm:w-[330px]"
          />
        </div>

        {scopeType === "month" ? (
          <div className="mt-4 max-w-xs">
            <Label htmlFor="export-month" className="mb-1.5 block text-[11.5px] text-mocha">
              Month
            </Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger id="export-month" aria-label="Export month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthChoices.map((choice) => (
                  <SelectItem key={choice} value={choice}>
                    {monthLabel(choice)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {scopeType === "range" ? (
          <div className="mt-4 grid max-w-md grid-cols-2 gap-2.5">
            <div>
              <Label htmlFor="export-from" className="mb-1.5 block text-[11.5px] text-mocha">
                From
              </Label>
              <DateField
                id="export-from"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="export-to" className="mb-1.5 block text-[11.5px] text-mocha">
                To
              </Label>
              <DateField
                id="export-to"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            {rangeError ? (
              <p className="col-span-2 text-[11px] text-terracotta" role="alert">
                {rangeError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-cream/25 px-3.5 py-3 sm:grid-cols-4">
          <div>
            <p className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-mocha">Range</p>
            <p className="mt-1 truncate text-[12px] font-medium text-espresso">
              {buildExportContextLabel(scopeArg)}
            </p>
          </div>
          <div>
            <p className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-mocha">Entries</p>
            <p className="amount mt-1 text-[12px] font-medium text-espresso">{summary.entries}</p>
          </div>
          <div>
            <p className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-mocha">Items</p>
            <p className="amount mt-1 text-[12px] font-medium text-espresso">
              {formatQuantity(summary.quantity)}
            </p>
          </div>
          <div>
            <p className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-mocha">Total</p>
            <p className="amount mt-1 truncate text-[12px] font-semibold text-espresso">
              {formatMoney(summary.amount, { currency })}
            </p>
          </div>
        </div>

        {scoped.length === 0 ? (
          <p className="mt-3 text-[11px] text-mocha">
            Nothing to export for this selection yet. Pick another period or add an expense.
          </p>
        ) : scopeType === "range" && from && to ? (
          <p className="mt-3 text-[10.5px] text-mocha">
            {formatDateMedium(from)} – {formatDateMedium(to)} · {summary.lines} item lines
          </p>
        ) : (
          <p className="mt-3 text-[10.5px] text-mocha">{summary.lines} item lines ready</p>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex flex-col p-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-parchment text-coffee">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-[13.5px] font-semibold text-espresso">CSV</h3>
          <p className="mt-1 flex-1 text-[11px] leading-relaxed text-mocha">
            Lightweight, portable and ready for any spreadsheet or accounting tool.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleCsv}
            disabled={disabled}
          >
            Download CSV
          </Button>
        </Card>

        <Card className="flex flex-col p-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#EDF1E8] text-sage-deep">
            <FileSpreadsheet className="size-4" aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-[13.5px] font-semibold text-espresso">Excel</h3>
          <p className="mt-1 flex-1 text-[11px] leading-relaxed text-mocha">
            A formatted .xlsx workbook with your expense sheet and a summary tab.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleExcel}
            disabled={disabled}
          >
            Download Excel
          </Button>
        </Card>

        <Card className="flex flex-col p-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#F8E4DC] text-[#8E4C33]">
            <Printer className="size-4" aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-[13.5px] font-semibold text-espresso">Printable PDF</h3>
          <p className="mt-1 flex-1 text-[11px] leading-relaxed text-mocha">
            A clean report view. Print it, or use your browser’s “Save as PDF”.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handlePdf}
            disabled={disabled}
          >
            Open print view
          </Button>
        </Card>
      </div>

      <p className="px-1 text-[10.5px] leading-relaxed text-mocha">
        Exports contain the date, item name, category, quantity, saved rate, recalculated amount,
        month and note. Balances are never altered by exporting.
      </p>
    </div>
  );
}

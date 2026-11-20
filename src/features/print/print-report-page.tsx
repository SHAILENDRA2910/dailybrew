import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { useCategories, useExpenses, useItems, useMonthClosures } from "@/hooks/queries";
import {
  categoryBreakdown,
  flattenExpenses,
  totalsFromLines,
} from "@/lib/analytics";
import {
  formatDateMedium,
  formatDateShort,
  formatRangeLabel,
  isValidISODate,
  isValidMonthKey,
  monthLabel,
  monthRange,
  shiftMonthKey,
  todayISO,
} from "@/lib/dates";
import { categoryTheme } from "@/lib/category-meta";
import { formatMoney, formatQuantity, formatRate } from "@/lib/money";
import type { Expense } from "@/types/domain";

export default function PrintReportPage() {
  const { workspace, profile, currency } = useWorkspaceContext();
  const [params] = useSearchParams();
  const { data: expenses = [], isLoading } = useExpenses(workspace.id);
  const { data: items = [] } = useItems(workspace.id);
  const { data: categories = [] } = useCategories(workspace.id);
  const { data: closures = [] } = useMonthClosures(workspace.id);

  const monthParam = params.get("month");
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const validMonth = monthParam && isValidMonthKey(monthParam) ? monthParam : null;
  const validRange =
    fromParam && toParam && isValidISODate(fromParam) && isValidISODate(toParam)
      ? { from: fromParam, to: toParam }
      : null;

  const scoped = useMemo<Expense[]>(() => {
    if (validMonth) {
      const range = monthRange(validMonth);
      return expenses.filter(
        (expense) =>
          expense.expense_date >= range.from && expense.expense_date <= range.to,
      );
    }
    if (validRange) {
      return expenses.filter(
        (expense) =>
          expense.expense_date >= validRange.from && expense.expense_date <= validRange.to,
      );
    }
    return expenses;
  }, [expenses, validMonth, validRange]);

  const lines = useMemo(
    () =>
      flattenExpenses(scoped, items, categories).sort((left, right) => {
        const dateOrder = left.date.localeCompare(right.date);
        if (dateOrder !== 0) return dateOrder;
        return left.itemName.localeCompare(right.itemName);
      }),
    [scoped, items, categories],
  );

  const totals = totalsFromLines(lines, scoped.length);
  const closure = validMonth
    ? closures.find((entry) => entry.month === validMonth) ?? null
    : null;
  const previousClosure = validMonth
    ? closures.find((entry) => entry.month === shiftMonthKey(validMonth, -1)) ?? null
    : null;
  const categoryTotals = categoryBreakdown(lines);
  const dates = lines.map((line) => line.date).sort();

  const scopeLabel = validMonth
    ? monthLabel(validMonth)
    : validRange
      ? formatRangeLabel(validRange.from, validRange.to)
      : dates.length > 0
        ? formatRangeLabel(dates[0] ?? "", dates[dates.length - 1] ?? "")
        : "All transactions";

  useEffect(() => {
    document.title = `DailyBrew report — ${scopeLabel}`;
  }, [scopeLabel]);

  if (isLoading) {
    return <p className="p-8 text-sm text-mocha">Preparing your report…</p>;
  }

  return (
    <div className="min-h-dvh bg-[#F1EADD] px-3 py-4 sm:px-6 sm:py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-3 flex max-w-4xl items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm" className="bg-white">
          <Link to="/data">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to import & export
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="size-3.5" aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </div>

      <article className="print-sheet mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-[0_20px_60px_-30px_rgba(56,37,29,0.35)] sm:p-10 print:max-w-none print:p-0">
        <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Brand />
            <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.04em] text-espresso">
              Expense report
            </h1>
            <p className="mt-1 text-[13px] text-mocha">
              {workspace.name} · {scopeLabel}
            </p>
            <p className="mt-0.5 text-[11px] text-mocha">
              Prepared for {profile?.full_name || "the workspace owner"} ·{" "}
              {formatDateMedium(todayISO())}
            </p>
            {closure ? (
              <p className="mt-1 inline-flex items-center rounded-full bg-[#EDF1E8] px-2.5 py-1 text-[9.5px] font-medium text-sage-deep">
                Closed {formatDateMedium(closure.closed_at.slice(0, 10))} · Closing total{" "}
                {formatMoney(closure.closing_total, { currency })}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl bg-[#FBF6EE] px-4 py-3 text-right">
            <p className="text-[9.5px] font-medium uppercase tracking-[0.13em] text-mocha">
              Total spent
            </p>
            <p className="amount mt-1 text-[26px] font-semibold text-espresso">
              {formatMoney(totals.amount, { currency })}
            </p>
            <p className="mt-0.5 text-[10.5px] text-mocha">
              {totals.entries} entries · {formatQuantity(totals.quantity)} items
            </p>
          </div>
        </header>

        {lines.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-mocha">
            No expenses are recorded for this period.
          </p>
        ) : (
          <>
            <section className="mt-6 grid grid-cols-3 divide-x divide-line rounded-xl border border-line">
              <div className="px-4 py-3">
                <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">
                  Entries
                </p>
                <p className="amount mt-1 text-[17px] font-semibold text-espresso">
                  {totals.entries}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">
                  Item lines
                </p>
                <p className="amount mt-1 text-[17px] font-semibold text-espresso">
                  {totals.lines}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">
                  Quantity
                </p>
                <p className="amount mt-1 text-[17px] font-semibold text-espresso">
                  {formatQuantity(totals.quantity)}
                </p>
              </div>
            </section>

            <section className="mt-7">
              <h2 className="text-[13px] font-semibold text-espresso">Itemised expenses</h2>
              <div className="mt-3 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[560px] border-collapse text-left text-[10.5px] print:min-w-0 print:text-[9.5px]">
                <thead>
                  <tr className="border-y border-line bg-[#FBF6EE] text-[8.5px] uppercase tracking-[0.08em] text-mocha">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Item</th>
                    <th className="px-2 py-2 font-medium">Category</th>
                    <th className="px-2 py-2 text-right font-medium">Qty</th>
                    <th className="px-2 py-2 text-right font-medium">Rate</th>
                    <th className="px-2 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {lines.map((line) => (
                    <tr key={line.lineId}>
                      <td className="whitespace-nowrap px-2 py-2 text-coffee">
                        {formatDateShort(line.date)}
                      </td>
                      <td className="px-2 py-2">
                        <span className="font-medium text-espresso">{line.itemName}</span>
                        {line.note ? (
                          <span className="block text-[9px] text-mocha">{line.note}</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-coffee">{line.categoryName}</td>
                      <td className="amount px-2 py-2 text-right text-coffee">
                        {formatQuantity(line.quantity)}
                      </td>
                      <td className="amount whitespace-nowrap px-2 py-2 text-right text-mocha">
                        {formatRate(line.unitRate, currency)}
                      </td>
                      <td className="amount whitespace-nowrap px-2 py-2 text-right font-medium text-espresso">
                        {formatMoney(line.amount, { currency })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-espresso/20">
                    <td colSpan={5} className="px-2 py-3 text-right text-[10px] font-medium text-mocha">
                      Total
                    </td>
                    <td className="amount px-2 py-3 text-right text-[13px] font-semibold text-espresso">
                      {formatMoney(totals.amount, { currency })}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </section>

            <section className="mt-7 grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="text-[13px] font-semibold text-espresso">Category summary</h2>
                <ul className="mt-3 space-y-2">
                  {categoryTotals.map((category) => {
                    const theme = categoryTheme(category.name);
                    return (
                      <li
                        key={category.name}
                        className="flex items-center justify-between gap-3 border-b border-line/60 pb-1.5 text-[10.5px]"
                      >
                        <span className="flex items-center gap-2 text-coffee">
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: theme.hex }}
                            aria-hidden="true"
                          />
                          {category.name}{" "}
                          <span className="text-[9px] text-mocha">{category.percentage}%</span>
                        </span>
                        <span className="amount font-medium text-espresso">
                          {formatMoney(category.amount, { currency })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="rounded-xl bg-[#FBF6EE] px-4 py-3 text-[10px] leading-relaxed text-mocha">
                <p className="font-medium text-espresso">About this report</p>
                <p className="mt-1.5">
                  Amounts are calculated from quantity × rate at the moment each expense was saved.
                  Later catalogue price changes do not rewrite this history.
                </p>
                <p className="mt-2">
                  {totals.lines} item lines across {totals.entries} expense entries. Currency:{" "}
                  {currency}.
                </p>
              </div>
            </section>
          </>
        )}

        {validMonth && (closure || previousClosure) ? (
          <section className="mt-6 grid gap-3 rounded-xl border border-line bg-[#FBF6EE] px-4 py-3 text-[10px] sm:grid-cols-2">
            <div>
              <p className="font-medium uppercase tracking-[0.1em] text-mocha">
                Carried from previous month
              </p>
              <p className="amount mt-1 font-semibold text-espresso">
                {previousClosure
                  ? formatMoney(previousClosure.closing_total, { currency })
                  : "No closed month before this one"}
              </p>
            </div>
            <div>
              <p className="font-medium uppercase tracking-[0.1em] text-mocha">Closing total</p>
              <p className="amount mt-1 font-semibold text-espresso">
                {closure
                  ? formatMoney(closure.closing_total, { currency })
                  : "Month still open"}
              </p>
            </div>
          </section>
        ) : null}

        <footer className="mt-10 flex flex-col gap-1 border-t border-line pt-4 text-[9.5px] text-mocha sm:flex-row sm:items-center sm:justify-between">
          <span>DailyBrew · Tea, coffee & eatery expense report</span>
          <span>
            Generated {formatDateMedium(todayISO())} · {workspace.name}
          </span>
        </footer>
      </article>
    </div>
  );
}

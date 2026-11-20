import {
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  IndianRupee,
  Plus,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useWorkspaceContext } from "@/app/workspace-context";
import { CoffeeIllustration, CoffeeRing } from "@/components/shared/brand";
import { StatTile } from "@/components/shared/stat-tile";
import { SpendingTrend } from "@/components/charts/spending-trend";
import { CategoryBars } from "@/components/charts/breakdown-bars";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  activeDayCount,
  averagePerActiveDay,
  budgetStatus,
  buildDailySeries,
  categoryBreakdown,
  expensesInMonth,
  flattenExpenses,
  groupExpensesByDate,
  itemBreakdown,
  percentChange,
  topByAmount,
  topByQuantity,
  totalsFromLines,
} from "@/lib/analytics";
import {
  currentMonthKey,
  dateGroupLabel,
  formatDateLong,
  monthLabelShort,
  monthRange,
  parseMonthKey,
  shiftISODate,
  shiftMonthKey,
  todayISO,
} from "@/lib/dates";
import { formatMoney, formatQuantity, formatRate } from "@/lib/money";
import { useBudgets, useCategories, useExpenses, useItems } from "@/hooks/queries";
import type { CategorySummary, ItemSummary, Totals } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { Expense } from "@/types/domain";

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function itemSummary(expense: Expense): string {
  const first = expense.items[0]?.item_name_snapshot ?? "Expense";
  if (expense.items.length <= 1) return first;
  return `${first} + ${expense.items.length - 1} more`;
}

function RecentExpenseRow({ expense, currency }: { expense: Expense; currency: string }) {
  const total = expense.items.reduce((sum, line) => sum + line.line_total, 0);
  const quantity = expense.items.reduce((sum, line) => sum + line.quantity, 0);
  const single = expense.items.length === 1 ? expense.items[0] : undefined;
  return (
    <Link
      to={`/expenses/${expense.id}/edit`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#FDF9F2] sm:px-5"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-parchment text-[11px] font-semibold text-coffee"
        aria-hidden="true"
      >
        {itemSummary(expense).charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-espresso">
          {itemSummary(expense)}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-mocha">
          {single ? `${formatQuantity(single.quantity)} × ${formatRate(single.unit_rate, currency)}` : `${quantity} items`}
          {expense.note ? ` · ${expense.note}` : ""}
        </span>
      </span>
      <span className="amount shrink-0 text-[13px] font-medium text-espresso">
        {formatMoney(total, { currency })}
      </span>
    </Link>
  );
}

interface BrewingInsightsProps {
  mostPoured: ItemSummary | null;
  topSpend: ItemSummary | null;
  categories: CategorySummary[];
  monthTotals: Totals;
  change: number | null;
  month: string;
  previousMonth: string;
  currency: string;
  className?: string;
}

function BrewingInsights({
  mostPoured,
  topSpend,
  categories,
  monthTotals,
  change,
  month,
  previousMonth,
  currency,
  className,
}: BrewingInsightsProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-caramel" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold text-espresso">What’s brewing</h2>
      </div>
      {monthTotals.lines === 0 ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-mocha">
          A clean page for {monthLabelShort(month)}. Insights appear as you log expenses.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-parchment/65 p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-mocha">
                Most poured
              </p>
              <p className="mt-1 truncate text-[12.5px] font-medium text-espresso">
                {mostPoured?.name ?? "—"}
              </p>
              <p className="mt-0.5 text-[10.5px] text-mocha">
                {mostPoured ? `${formatQuantity(mostPoured.quantity)} items` : "No items yet"}
              </p>
            </div>
            <div className="rounded-xl bg-parchment/65 p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-mocha">
                Top spend
              </p>
              <p className="mt-1 truncate text-[12.5px] font-medium text-espresso">
                {topSpend?.name ?? "—"}
              </p>
              <p className="mt-0.5 text-[10.5px] text-mocha">
                {topSpend ? formatMoney(topSpend.amount, { currency }) : "No spend yet"}
              </p>
            </div>
          </div>
          <div className="mt-5 border-t border-line/70 pt-4">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.1em] text-mocha">
              By category
            </p>
            <CategoryBars categories={categories.slice(0, 3)} currency={currency} />
          </div>
          {change !== null ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#EDF1E8]/70 px-3 py-2 text-[11px] text-sage-deep">
              {change <= 0 ? (
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
              ) : (
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              )}
              <span>
                {Math.abs(change)}% {change <= 0 ? "less" : "more"} than{" "}
                {monthLabelShort(previousMonth)}
              </span>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

export default function HomePage() {
  const { workspace, profile, currency } = useWorkspaceContext();
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(workspace.id);
  const { data: items = [] } = useItems(workspace.id);
  const { data: categories = [] } = useCategories(workspace.id);
  const { data: budgets = [] } = useBudgets(workspace.id);

  const today = todayISO();
  const month = currentMonthKey();
  const previousMonth = shiftMonthKey(month, -1);
  const { year, month: monthNumber } = parseMonthKey(month);

  const view = useMemo(() => {
    const allLines = flattenExpenses(expenses, items, categories);
    const todayExpenses = expenses.filter((expense) => expense.expense_date === today);
    const todayLines = allLines.filter((line) => line.date === today);
    const todayTotals = totalsFromLines(todayLines, todayExpenses.length);

    const monthExpenses = expensesInMonth(expenses, month);
    const monthLines = allLines.filter((line) => line.date.slice(0, 7) === month);
    const monthTotals = totalsFromLines(monthLines, monthExpenses.length);

    const previousLines = allLines.filter((line) => line.date.slice(0, 7) === previousMonth);
    const previousTotal = previousLines.reduce((total, line) => total + line.amount, 0);

    const trendFrom = shiftISODate(today, -13);
    const trend = buildDailySeries(allLines, trendFrom, today);
    const recentGroups = groupExpensesByDate(expenses).slice(0, 2);
    const itemsBreakdown = itemBreakdown(monthLines);
    const categoriesBreakdown = categoryBreakdown(monthLines);

    const budget = budgets.find(
      (entry) => entry.year === year && entry.month === monthNumber,
    );
    return {
      allLines,
      todayTotals,
      monthTotals,
      monthExpenses,
      previousTotal,
      trend,
      recentGroups,
      mostPoured: topByQuantity(monthLines),
      topSpend: topByAmount(monthLines),
      itemsBreakdown,
      categoriesBreakdown,
      activeDays: activeDayCount(monthLines),
      average: averagePerActiveDay(monthLines),
      budget,
      budgetState: budgetStatus(monthTotals.amount, budget?.budget_amount ?? 0),
      monthRange: monthRange(month),
      change: percentChange(monthTotals.amount, previousTotal),
    };
  }, [expenses, items, categories, budgets, today, month, previousMonth, year, monthNumber]);

  const firstName = profile?.full_name.trim().split(/\s+/)[0] || "there";
  const hasAnyExpenses = expenses.length > 0;
  const trendTotal = view.trend.reduce((total, point) => total + point.amount, 0);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 sm:mb-7">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.15em] text-mocha">
            {formatDateLong(today)}
          </p>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-0.04em] text-espresso lg:text-[32px]">
            {greetingForNow()}, {firstName}.
          </h1>
          <p className="mt-1 hidden text-[13px] text-mocha sm:block">
            A clear look at today, and the habit behind it.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
          <Link to="/add">
            <Plus className="size-3.5" />
            Add expense
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <div className="space-y-4 lg:space-y-5">
          {view.budgetState.hasBudget && view.budgetState.tone !== "on-track" ? (
            <Link
              to="/budgets"
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                view.budgetState.tone === "over"
                  ? "border-[#EFCFC4] bg-[#FBF1EC] hover:bg-[#F7E4DC]"
                  : "border-[#EAD6B8] bg-[#FBF4E7] hover:bg-[#F8EBD7]",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  view.budgetState.tone === "over"
                    ? "bg-[#F3DCD2] text-[#8E4C33]"
                    : "bg-[#F5E2C6] text-[#8B5C31]",
                )}
              >
                <Flame className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-espresso">
                  {view.budgetState.tone === "over"
                    ? `Over the ${monthLabelShort(month)} budget`
                    : `${view.budgetState.percentUsed}% of the ${monthLabelShort(month)} budget used`}
                </span>
                <span className="mt-0.5 block text-[10.5px] text-mocha">
                  {view.budgetState.tone === "over"
                    ? `${formatMoney(Math.abs(view.budgetState.remaining), { currency })} over`
                    : `${formatMoney(view.budgetState.remaining, { currency })} left`}
                  {" · "}
                  {formatMoney(view.budgetState.spent, { currency })} of{" "}
                  {formatMoney(view.budgetState.budget, { currency })}
                </span>
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-mocha" aria-hidden="true" />
            </Link>
          ) : null}

          <section className="relative overflow-hidden rounded-[26px] bg-espresso p-5 text-ivory shadow-lift sm:p-7">
            <CoffeeRing className="pointer-events-none absolute -right-16 -top-24 size-[260px] opacity-80" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.17em] text-cream/65">
                    Today’s spending
                  </p>
                  <p className="amount mt-2 text-[42px] font-semibold leading-none tracking-[-0.045em] sm:text-[50px]">
                    {formatMoney(view.todayTotals.amount, { currency })}
                  </p>
                </div>
                <span className="rounded-full border border-ivory/15 bg-ivory/10 px-3 py-1.5 text-[10.5px] font-medium text-cream/85">
                  {view.todayTotals.entries === 0
                    ? "Nothing yet"
                    : `${view.todayTotals.entries} ${view.todayTotals.entries === 1 ? "entry" : "entries"}`}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-cream/70">
                <span>{formatQuantity(view.todayTotals.quantity)} items today</span>
                <span className="size-1 rounded-full bg-cream/35" aria-hidden="true" />
                <span>
                  {view.todayTotals.entries === 0
                    ? "A fresh cup awaits."
                    : "Warmly accounted for."}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild variant="cream" className="h-10 px-4 text-[13px]">
                  <Link to="/add">
                    <Plus className="size-4" aria-hidden="true" />
                    Add expense
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-10 border-ivory/20 bg-ivory/5 px-4 text-[13px] text-cream hover:bg-ivory/10 hover:text-ivory"
                >
                  <Link to="/reports">View report</Link>
                </Button>
              </div>
            </div>
          </section>

          <div className="space-y-2 lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                label="This month"
                value={formatMoney(view.monthTotals.amount, { currency })}
                icon={IndianRupee}
                hint={
                  view.change === null
                    ? "First month of tracking"
                    : `${view.change > 0 ? "↑" : view.change < 0 ? "↓" : "→"} ${Math.abs(view.change)}% vs ${monthLabelShort(previousMonth)}`
                }
              />
              <StatTile
                label="Avg. active day"
                value={formatMoney(view.average, { currency })}
                icon={TrendingUp}
                hint={`${view.activeDays} active ${view.activeDays === 1 ? "day" : "days"} this month`}
              />
            </div>
            <Card className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-mocha">
                  Items this month
                </p>
                <p className="mt-0.5 text-[10.5px] text-mocha">
                  Across {view.activeDays} active {view.activeDays === 1 ? "day" : "days"}
                </p>
              </div>
              <p className="amount text-[22px] font-semibold text-espresso">
                {formatQuantity(view.monthTotals.quantity)}
              </p>
            </Card>
          </div>

          {!hasAnyExpenses ? (
            <Card className="overflow-hidden border-cream-deep/50">
              <div className="grid items-center gap-5 p-5 sm:grid-cols-[1fr_170px] sm:p-6">
                <div>
                  <Badge variant="sage">Your ledger is ready</Badge>
                  <h2 className="mt-2.5 text-xl font-semibold tracking-[-0.03em] text-espresso">
                    Start with the tracker you already keep.
                  </h2>
                  <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-mocha">
                    Import the 2026 workbook to see every cup, biscuit and daily total — or add
                    your first expense in a few seconds.
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm">
                      <Link to="/data?sample=1">Import 2026 tracker</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/add">Add expense</Link>
                    </Button>
                  </div>
                </div>
                <CoffeeIllustration className="mx-auto hidden max-w-[160px] sm:block" />
              </div>
            </Card>
          ) : null}

          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">
                  Spending rhythm
                </p>
                <h2 className="mt-1 text-[15px] font-semibold text-espresso">The last 14 days</h2>
              </div>
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-coffee hover:text-espresso"
              >
                Reports <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-4">
              <SpendingTrend points={view.trend} currency={currency} height={172} />
            </div>
            <p className="sr-only">
              Daily spending for the last 14 days totals {formatMoney(trendTotal, { currency })}.
            </p>
          </Card>

          <BrewingInsights
            mostPoured={view.mostPoured}
            topSpend={view.topSpend}
            categories={view.categoriesBreakdown}
            monthTotals={view.monthTotals}
            change={view.change}
            month={month}
            previousMonth={previousMonth}
            currency={currency}
            className="lg:hidden"
          />

          <section>
            <div className="mb-2.5 flex items-baseline justify-between px-0.5">
              <h2 className="text-[14px] font-semibold text-espresso">Recent activity</h2>
              <Link
                to="/expenses"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-coffee hover:text-espresso"
              >
                View all <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
            {view.recentGroups.length === 0 ? (
              <Card className="px-5 py-6 text-[13px] text-mocha">
                No expenses yet. Your first cup will appear here.
              </Card>
            ) : (
              <div className="space-y-4">
                {view.recentGroups.map((group) => (
                  <div key={group.date}>
                    <div className="mb-2 flex items-baseline justify-between px-0.5">
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-mocha">
                        {dateGroupLabel(group.date)}
                      </p>
                      <p className="amount text-[11.5px] font-medium text-coffee">
                        {formatMoney(group.total, { currency })}
                      </p>
                    </div>
                    <Card className="divide-y divide-line/60 overflow-hidden">
                      {group.expenses.slice(0, 4).map((expense) => (
                        <RecentExpenseRow key={expense.id} expense={expense} currency={currency} />
                      ))}
                      {group.expenses.length > 4 ? (
                        <Link
                          to="/expenses"
                          className="block px-4 py-2.5 text-[11.5px] font-medium text-coffee hover:bg-[#FDF9F2]"
                        >
                          +{group.expenses.length - 4} more entries
                        </Link>
                      ) : null}
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="hidden space-y-4 lg:block lg:space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="This month"
              value={formatMoney(view.monthTotals.amount, { currency })}
              icon={IndianRupee}
              hint={
                view.change === null
                  ? "First month of tracking"
                  : `${view.change > 0 ? "↑" : view.change < 0 ? "↓" : "→"} ${Math.abs(view.change)}% vs ${monthLabelShort(previousMonth)}`
              }
            />
            <StatTile
              label="Avg. active day"
              value={formatMoney(view.average, { currency })}
              icon={TrendingUp}
              hint={`${view.activeDays} active ${view.activeDays === 1 ? "day" : "days"} this month`}
            />
          </div>

          {view.budgetState.hasBudget ? (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">
                    Monthly budget
                  </p>
                  <p className="amount mt-1.5 text-[22px] font-semibold text-espresso">
                    {formatMoney(view.budgetState.remaining, { currency })}
                    <span className="ml-1 text-[11px] font-normal text-mocha">
                      {view.budgetState.remaining >= 0 ? "left" : "over"}
                    </span>
                  </p>
                </div>
                <span className="flex size-8 items-center justify-center rounded-full bg-parchment text-coffee">
                  <Wallet className="size-3.5" aria-hidden="true" />
                </span>
              </div>
              <Progress
                value={view.budgetState.barPercent}
                className="mt-4 h-2"
                barClassName={
                  view.budgetState.tone === "over"
                    ? "bg-terracotta"
                    : view.budgetState.tone === "warning"
                      ? "bg-caramel"
                      : "bg-sage"
                }
                label="Monthly budget used"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-mocha">
                <span>{view.budgetState.percentUsed}% of {formatMoney(view.budgetState.budget, { currency })}</span>
                <Link to="/budgets" className="font-medium text-coffee hover:text-espresso">
                  Adjust
                </Link>
              </div>
              {view.budgetState.tone !== "on-track" ? (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-[#F8E4DC]/60 px-2.5 py-2 text-[11px] leading-snug text-[#8E4C33]">
                  <Flame className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {view.budgetState.tone === "over"
                    ? "You’re over budget for this month."
                    : "You’re nearing this month’s budget."}
                </p>
              ) : null}
            </Card>
          ) : null}

          <BrewingInsights
            mostPoured={view.mostPoured}
            topSpend={view.topSpend}
            categories={view.categoriesBreakdown}
            monthTotals={view.monthTotals}
            change={view.change}
            month={month}
            previousMonth={previousMonth}
            currency={currency}
            className="hidden lg:block"
          />
        </div>
      </div>

      {loadingExpenses ? (
        <p className="mt-4 text-center text-[11px] text-mocha" aria-live="polite">
          Gathering your ledger…
        </p>
      ) : null}
    </div>
  );
}

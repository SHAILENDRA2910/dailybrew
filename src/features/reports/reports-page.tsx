import {
  ChartPie,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspaceContext } from "@/app/workspace-context";
import { EmptyState } from "@/components/shared/empty-state";
import { MonthNavigator } from "@/components/shared/month-navigator";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedControl, type SegmentedOption } from "@/components/shared/segmented-control";
import { StatTile } from "@/components/shared/stat-tile";
import { SpendingBars, SpendingTrend } from "@/components/charts/spending-trend";
import { ComparisonChart, type ComparisonDatum } from "@/components/charts/comparison-chart";
import {
  CategoryCard,
  ConsumptionComparison,
  HighestItemCard,
  ItemBreakdownCard,
} from "@/features/reports/report-parts";
import { MonthCloseCard } from "@/features/reports/month-close-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  activeDayCount,
  activeMonthKeys,
  averagePerActiveDay,
  buildDailySeries,
  categoryBreakdown,
  compareItemConsumption,
  expensesInMonth,
  expensesInRange,
  flattenExpenses,
  itemBreakdown,
  percentChange,
  topByAmount,
  totalsFromLines,
} from "@/lib/analytics";
import {
  currentMonthKey,
  formatDateLong,
  formatDateMedium,
  formatDateShort,
  formatRangeLabel,
  monthLabel,
  monthLabelShort,
  monthRange,
  shiftISODate,
  shiftMonthKey,
  todayISO,
  weekRange,
} from "@/lib/dates";
import { formatMoney, formatQuantity } from "@/lib/money";
import { useCategories, useExpenses, useItems } from "@/hooks/queries";

type ReportTab = "daily" | "weekly" | "monthly" | "compare";

const reportTabs: SegmentedOption<ReportTab>[] = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
  { value: "compare", label: "Compare" },
];

function PeriodPager({
  label,
  onPrevious,
  onNext,
  nextDisabled,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <div className="inline-flex h-11 max-w-full items-center rounded-full border border-line bg-white px-1 shadow-card">
      <button
        type="button"
        onClick={onPrevious}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-mocha transition-colors hover:bg-parchment hover:text-espresso"
        aria-label="Previous period"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="max-w-[190px] truncate px-2 text-center text-[12px] font-medium text-espresso sm:max-w-none">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-mocha transition-colors hover:bg-parchment hover:text-espresso disabled:pointer-events-none disabled:opacity-30"
        aria-label="Next period"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

export default function ReportsPage() {
  const { workspace, currency } = useWorkspaceContext();
  const { data: expenses = [] } = useExpenses(workspace.id);
  const { data: items = [] } = useItems(workspace.id);
  const { data: categories = [] } = useCategories(workspace.id);

  const [tab, setTab] = useState<ReportTab>("monthly");
  const [day, setDay] = useState(todayISO());
  const [weekAnchor, setWeekAnchor] = useState(todayISO());
  const [month, setMonth] = useState(currentMonthKey());
  const [focusMonth, setFocusMonth] = useState(currentMonthKey());
  const [baselineMonth, setBaselineMonth] = useState(shiftMonthKey(currentMonthKey(), -1));

  const today = todayISO();
  const thisMonth = currentMonthKey();

  const allLines = useMemo(
    () => flattenExpenses(expenses, items, categories),
    [expenses, items, categories],
  );

  const monthChoices = useMemo(() => {
    const set = new Set(activeMonthKeys(expenses));
    set.add(thisMonth);
    set.add(month);
    set.add(focusMonth);
    set.add(baselineMonth);
    return [...set].sort((left, right) => right.localeCompare(left));
  }, [expenses, thisMonth, month, focusMonth, baselineMonth]);

  const daily = useMemo(() => {
    const dayExpenses = expenses.filter((expense) => expense.expense_date === day);
    const lines = allLines.filter((line) => line.date === day);
    return {
      lines,
      entries: dayExpenses.length,
      totals: totalsFromLines(lines, dayExpenses.length),
      items: itemBreakdown(lines),
      categories: categoryBreakdown(lines),
      highest: topByAmount(lines),
    };
  }, [allLines, expenses, day]);

  const week = useMemo(() => weekRange(weekAnchor), [weekAnchor]);
  const weekly = useMemo(() => {
    const weekExpenses = expensesInRange(expenses, week.from, week.to);
    const lines = allLines.filter((line) => line.date >= week.from && line.date <= week.to);
    return {
      lines,
      entries: weekExpenses.length,
      totals: totalsFromLines(lines, weekExpenses.length),
      points: buildDailySeries(lines, week.from, week.to),
      items: itemBreakdown(lines),
      categories: categoryBreakdown(lines),
      activeDays: activeDayCount(lines),
      average: averagePerActiveDay(lines),
    };
  }, [allLines, expenses, week.from, week.to]);

  const monthBounds = useMemo(() => monthRange(month), [month]);
  const monthly = useMemo(() => {
    const monthExpenses = expensesInMonth(expenses, month);
    const lines = allLines.filter((line) => line.date.slice(0, 7) === month);
    return {
      lines,
      entries: monthExpenses.length,
      totals: totalsFromLines(lines, monthExpenses.length),
      points: buildDailySeries(lines, monthBounds.from, monthBounds.to),
      items: itemBreakdown(lines),
      categories: categoryBreakdown(lines),
      activeDays: activeDayCount(lines),
      average: averagePerActiveDay(lines),
    };
  }, [allLines, expenses, month, monthBounds.from, monthBounds.to]);

  const comparison = useMemo(() => {
    const focusLines = allLines.filter((line) => line.date.slice(0, 7) === focusMonth);
    const baselineLines = allLines.filter(
      (line) => line.date.slice(0, 7) === baselineMonth,
    );
    const focusExpenses = expensesInMonth(expenses, focusMonth);
    const baselineExpenses = expensesInMonth(expenses, baselineMonth);
    const focusTotals = totalsFromLines(focusLines, focusExpenses.length);
    const baselineTotals = totalsFromLines(baselineLines, baselineExpenses.length);
    const focusCategories = categoryBreakdown(focusLines);
    const baselineCategories = categoryBreakdown(baselineLines);
    const categoryNames = new Set([
      ...focusCategories.map((category) => category.name),
      ...baselineCategories.map((category) => category.name),
    ]);
    const categoryData: ComparisonDatum[] = [...categoryNames]
      .map((name) => ({
        name,
        current: focusCategories.find((category) => category.name === name)?.amount ?? 0,
        previous: baselineCategories.find((category) => category.name === name)?.amount ?? 0,
      }))
      .sort((left, right) => right.current + right.previous - (left.current + left.previous))
      .slice(0, 6);
    return {
      focusTotals,
      baselineTotals,
      categoryData,
      consumption: compareItemConsumption(focusLines, baselineLines),
      change: percentChange(focusTotals.amount, baselineTotals.amount),
    };
  }, [allLines, expenses, focusMonth, baselineMonth]);

  const showEmptyState =
    (tab === "daily" && daily.lines.length === 0) ||
    (tab === "weekly" && weekly.lines.length === 0) ||
    (tab === "monthly" && monthly.lines.length === 0) ||
    (tab === "compare" && comparison.focusTotals.lines === 0 && comparison.baselineTotals.lines === 0);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Patterns, not pressure. Every chart is drawn from the ledger you keep."
        actions={
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link to="/add">
              <Plus className="size-3.5" aria-hidden="true" />
              Add expense
            </Link>
          </Button>
        }
      />

      <SegmentedControl
        options={reportTabs}
        value={tab}
        onChange={setTab}
        ariaLabel="Report period"
        className="max-w-md"
      />

      <div className="mb-4 mt-3 flex flex-wrap items-end gap-2">
        {tab === "daily" ? (
          <>
            <PeriodPager
              label={formatDateLong(day)}
              onPrevious={() => setDay(shiftISODate(day, -1))}
              onNext={() => setDay(shiftISODate(day, 1))}
              nextDisabled={day >= today}
            />
            {day !== today ? (
              <Button variant="outline" size="sm" onClick={() => setDay(today)}>
                Today
              </Button>
            ) : null}
          </>
        ) : null}

        {tab === "weekly" ? (
          <>
            <PeriodPager
              label={formatRangeLabel(week.from, week.to)}
              onPrevious={() => setWeekAnchor(shiftISODate(weekAnchor, -7))}
              onNext={() => setWeekAnchor(shiftISODate(weekAnchor, 7))}
              nextDisabled={week.to >= today}
            />
            {week.to < today ? (
              <Button variant="outline" size="sm" onClick={() => setWeekAnchor(today)}>
                This week
              </Button>
            ) : null}
          </>
        ) : null}

        {tab === "monthly" ? (
          <>
            <MonthNavigator
              value={month}
              onChange={setMonth}
              disabledNext={month >= thisMonth}
            />
            {month !== thisMonth ? (
              <Button variant="outline" size="sm" onClick={() => setMonth(thisMonth)}>
                This month
              </Button>
            ) : null}
          </>
        ) : null}

        {tab === "compare" ? (
          <div className="grid w-full max-w-md grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="compare-focus" className="text-[11px] text-mocha">
                Focus month
              </Label>
              <Select
                value={focusMonth}
                onValueChange={(value) => {
                  setFocusMonth(value);
                  if (value === baselineMonth) {
                    setBaselineMonth(shiftMonthKey(value, -1));
                  }
                }}
              >
                <SelectTrigger id="compare-focus" aria-label="Focus month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthChoices.map((choice) => (
                    <SelectItem key={choice} value={choice} disabled={choice === baselineMonth}>
                      {monthLabel(choice)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compare-baseline" className="text-[11px] text-mocha">
                Compared with
              </Label>
              <Select
                value={baselineMonth}
                onValueChange={(value) => {
                  setBaselineMonth(value);
                  if (value === focusMonth) {
                    setFocusMonth(shiftMonthKey(value, -1));
                  }
                }}
              >
                <SelectTrigger id="compare-baseline" aria-label="Baseline month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthChoices.map((choice) => (
                    <SelectItem key={choice} value={choice} disabled={choice === focusMonth}>
                      {monthLabel(choice)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>

      {tab === "daily" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Total spent" value={formatMoney(daily.totals.amount, { currency })} icon={Wallet} hint={`${daily.entries} ${daily.entries === 1 ? "entry" : "entries"}`} />
            <StatTile label="Items consumed" value={formatQuantity(daily.totals.quantity)} icon={Package} hint={`${daily.totals.lines} item ${daily.totals.lines === 1 ? "line" : "lines"}`} />
            <StatTile label="Entries" value={String(daily.entries)} icon={ReceiptText} hint={formatDateMedium(day)} />
            <StatTile label="Highest item" value={formatMoney(daily.highest?.amount ?? 0, { currency })} icon={TrendingUp} hint={daily.highest?.name ?? "No spend yet"} />
          </div>
          {showEmptyState ? (
            <div className="mt-4">
              <EmptyState
                icon={ChartPie}
                title="Nothing recorded for this day."
                description="Pick another date or add an expense to start this day’s report."
                action={<Button asChild><Link to="/add">Add expense</Link></Button>}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <HighestItemCard item={daily.highest} currency={currency} />
              <div className="grid gap-4 lg:grid-cols-2">
                <ItemBreakdownCard items={daily.items} currency={currency} subtitle="A day in items" />
                <CategoryCard categories={daily.categories} total={daily.totals.amount} currency={currency} />
              </div>
            </div>
          )}
        </>
      ) : null}

      {tab === "weekly" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Week total" value={formatMoney(weekly.totals.amount, { currency })} icon={Wallet} hint={formatRangeLabel(week.from, week.to)} />
            <StatTile label="Avg. active day" value={formatMoney(weekly.average, { currency })} icon={TrendingUp} hint="Across days with spending" />
            <StatTile label="Active days" value={`${weekly.activeDays}`} icon={ReceiptText} hint="Days you logged an expense" />
            <StatTile label="Items" value={formatQuantity(weekly.totals.quantity)} icon={Package} hint={`${weekly.entries} entries`} />
          </div>
          {showEmptyState ? (
            <div className="mt-4">
              <EmptyState
                icon={ChartPie}
                title="This week is still blank."
                description="Choose another week or log your first expense. Reports fill themselves in."
                action={<Button asChild><Link to="/add">Add expense</Link></Button>}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <Card className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">
                      Day by day
                    </p>
                    <h2 className="mt-1 text-[15px] font-semibold text-espresso">The week in cups</h2>
                  </div>
                  <p className="amount text-[15px] font-semibold text-espresso">
                    {formatMoney(weekly.totals.amount, { currency })}
                  </p>
                </div>
                <div className="mt-4">
                  <SpendingBars points={weekly.points} currency={currency} height={190} />
                </div>
                <p className="sr-only">
                  Daily spend for {formatDateMedium(week.from)} to {formatDateMedium(week.to)}.
                </p>
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <ItemBreakdownCard items={weekly.items} currency={currency} subtitle="This week’s favourites" />
                <CategoryCard categories={weekly.categories} total={weekly.totals.amount} currency={currency} />
              </div>
            </div>
          )}
        </>
      ) : null}

      {tab === "monthly" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Month total" value={formatMoney(monthly.totals.amount, { currency })} icon={Wallet} hint={`${monthly.entries} entries`} />
            <StatTile label="Daily average" value={formatMoney(monthly.average, { currency })} icon={TrendingUp} hint="Per active day" />
            <StatTile label="Active days" value={`${monthly.activeDays}`} icon={ReceiptText} hint={monthLabel(month)} />
            <StatTile label="Items consumed" value={formatQuantity(monthly.totals.quantity)} icon={Package} hint={`${monthly.totals.lines} item lines`} />
          </div>
          {showEmptyState ? (
            <div className="mt-4">
              <EmptyState
                icon={ChartPie}
                title={`No expenses in ${monthLabel(month)}.`}
                description="Try another month, or add an expense and watch the month take shape."
                action={<Button asChild><Link to="/add">Add expense</Link></Button>}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <Card className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">
                      Daily rhythm
                    </p>
                    <h2 className="mt-1 text-[15px] font-semibold text-espresso">
                      {monthLabel(month)}
                    </h2>
                  </div>
                  <p className="amount text-[15px] font-semibold text-espresso">
                    {formatMoney(monthly.totals.amount, { currency })}
                  </p>
                </div>
                <div className="mt-4">
                  <SpendingTrend points={monthly.points} currency={currency} height={200} />
                </div>
                <p className="sr-only">
                  Daily spending through {monthLabel(month)}. Monthly total{" "}
                  {formatMoney(monthly.totals.amount, { currency })}.
                </p>
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <ItemBreakdownCard items={monthly.items} currency={currency} subtitle="The month in items" />
                <CategoryCard categories={monthly.categories} total={monthly.totals.amount} currency={currency} />
              </div>
            </div>
          )}
          <MonthCloseCard
            month={month}
            total={monthly.totals.amount}
            entries={monthly.totals.entries}
            quantity={monthly.totals.quantity}
          />
        </>
      ) : null}

      {tab === "compare" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={monthLabelShort(focusMonth)} value={formatMoney(comparison.focusTotals.amount, { currency })} icon={Wallet} hint={`${comparison.focusTotals.entries} entries`} />
            <StatTile label={monthLabelShort(baselineMonth)} value={formatMoney(comparison.baselineTotals.amount, { currency })} icon={Wallet} hint={`${comparison.baselineTotals.entries} entries`} />
            <StatTile
              label="Change"
              value={comparison.change === null ? "New" : `${comparison.change > 0 ? "+" : ""}${comparison.change}%`}
              icon={TrendingUp}
              hint={comparison.change === null ? "No baseline spend" : "Spending vs baseline"}
            />
            <StatTile label="Items" value={formatQuantity(comparison.focusTotals.quantity)} icon={Package} hint={`vs ${formatQuantity(comparison.baselineTotals.quantity)} baseline`} />
          </div>
          {showEmptyState ? (
            <div className="mt-4">
              <EmptyState
                icon={ChartPie}
                title="Nothing to compare yet."
                description="Pick months with saved expenses, or add an entry to begin the comparison."
                action={<Button asChild><Link to="/add">Add expense</Link></Button>}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <Card className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">
                      Category movement
                    </p>
                    <h2 className="mt-1 text-[15px] font-semibold text-espresso">
                      {monthLabel(focusMonth)} vs {monthLabel(baselineMonth)}
                    </h2>
                  </div>
                </div>
                {comparison.categoryData.length === 0 ? (
                  <p className="mt-4 text-[12.5px] text-mocha">
                    No category spend to compare in the selected months.
                  </p>
                ) : (
                  <div className="mt-4">
                    <ComparisonChart
                      data={comparison.categoryData}
                      currency={currency}
                      currentLabel={monthLabelShort(focusMonth)}
                      previousLabel={monthLabelShort(baselineMonth)}
                    />
                  </div>
                )}
              </Card>
              <ConsumptionComparison
                items={comparison.consumption}
                currency={currency}
                currentLabel={monthLabel(focusMonth)}
                previousLabel={monthLabel(baselineMonth)}
              />
            </div>
          )}
        </>
      ) : null}

      <p className="mt-5 px-1 text-[10.5px] text-mocha">
        {tab === "daily"
          ? `Showing ${formatDateShort(day)}. Every figure is calculated from saved expenses.`
          : tab === "weekly"
            ? `Week of ${formatDateMedium(week.from)} to ${formatDateMedium(week.to)}.`
            : tab === "monthly"
              ? `Showing ${monthLabel(month)}.`
              : "Comparison uses each item line’s saved snapshot, not today’s catalogue rates."}
      </p>
    </div>
  );
}

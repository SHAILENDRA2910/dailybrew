import {
  CalendarDays,
  Plus,
  ReceiptText,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExpenseFilterDialog, defaultExpenseFilters, type ExpenseFilters } from "@/features/expenses/expense-filter-dialog";
import { ExpenseTable } from "@/features/expenses/expense-table";
import { buildExpenseLineRows, expenseQuantity, expenseTotal } from "@/features/expenses/rows";
import { useCategories, useDeleteExpense, useExpenses, useItems, useRestoreExpense } from "@/hooks/queries";
import { activeMonthKeys, groupExpensesByDate } from "@/lib/analytics";
import {
  currentMonthKey,
  dateGroupLabel,
  formatDateMedium,
  formatDateShort,
  monthKeyFromISO,
  monthLabel,
} from "@/lib/dates";
import { formatMoney, formatQuantity, formatRate } from "@/lib/money";
import type { Expense } from "@/types/domain";

const sortLabels: Record<ExpenseFilters["sort"], string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "amount-desc": "Highest amount",
  "amount-asc": "Lowest amount",
};

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white pl-2.5 pr-1 text-[10.5px] font-medium text-coffee">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="flex size-5 items-center justify-center rounded-full text-mocha hover:bg-parchment hover:text-espresso"
        aria-label={`Remove ${label} filter`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

export default function ExpensesPage() {
  const { workspace, currency } = useWorkspaceContext();
  const { data: expenses = [], isLoading } = useExpenses(workspace.id);
  const { data: items = [] } = useItems(workspace.id);
  const { data: categories = [] } = useCategories(workspace.id);
  const deleteMutation = useDeleteExpense(workspace.id);
  const restoreMutation = useRestoreExpense(workspace.id);

  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("all");
  const [filters, setFilters] = useState<ExpenseFilters>(defaultExpenseFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

  const itemCategoryId = useMemo(
    () => new Map(items.map((item) => [item.id, item.category_id])),
    [items],
  );

  const monthOptions = useMemo(() => {
    const set = new Set(activeMonthKeys(expenses));
    set.add(currentMonthKey());
    return [...set].sort((left, right) => right.localeCompare(left));
  }, [expenses]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (filters.from && filters.to) {
        if (expense.expense_date < filters.from || expense.expense_date > filters.to) return false;
      } else if (month !== "all" && monthKeyFromISO(expense.expense_date) !== month) {
        return false;
      }
      if (
        filters.categoryId !== "all" &&
        !expense.items.some((line) => itemCategoryId.get(line.item_id) === filters.categoryId)
      ) {
        return false;
      }
      if (
        filters.itemId !== "all" &&
        !expense.items.some((line) => line.item_id === filters.itemId)
      ) {
        return false;
      }
      if (term) {
        const inItems = expense.items.some((line) =>
          line.item_name_snapshot.toLowerCase().includes(term),
        );
        if (!inItems && !expense.note.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [expenses, filters, itemCategoryId, month, search]);

  const sortedExpenses = useMemo(() => {
    const sorted = [...filtered];
    sorted.sort((left, right) => {
      if (filters.sort === "amount-desc" || filters.sort === "amount-asc") {
        const difference = expenseTotal(left) - expenseTotal(right);
        return filters.sort === "amount-desc" ? -difference : difference;
      }
      const dateOrder = left.expense_date.localeCompare(right.expense_date);
      if (dateOrder !== 0) {
        return filters.sort === "date-asc" ? dateOrder : -dateOrder;
      }
      const createdOrder = left.created_at.localeCompare(right.created_at);
      return filters.sort === "date-asc" ? createdOrder : -createdOrder;
    });
    return sorted;
  }, [filtered, filters.sort]);

  const summary = useMemo(() => {
    const amount = filtered.reduce((total, expense) => total + expenseTotal(expense), 0);
    const quantity = filtered.reduce((total, expense) => total + expenseQuantity(expense), 0);
    return { amount, quantity, entries: filtered.length };
  }, [filtered]);

  const groups = useMemo(() => {
    const grouped = groupExpensesByDate(filtered);
    return filters.sort === "date-asc" ? grouped.reverse() : grouped;
  }, [filtered, filters.sort]);

  const tableRows = useMemo(
    () => buildExpenseLineRows(filtered, items, categories),
    [filtered, items, categories],
  );

  const activeCategory = categories.find((category) => category.id === filters.categoryId);
  const activeItem = items.find((item) => item.id === filters.itemId);
  const advancedCount =
    (filters.from ? 1 : 0) +
    (filters.categoryId !== "all" ? 1 : 0) +
    (filters.itemId !== "all" ? 1 : 0) +
    (filters.sort !== "date-desc" ? 1 : 0);
  const hasAnyFilter =
    month !== "all" || advancedCount > 0 || search.trim().length > 0;

  const clearEverything = () => {
    setMonth("all");
    setFilters(defaultExpenseFilters);
    setSearch("");
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      const deleted = await deleteMutation.mutateAsync(target.id);
      setPendingDelete(null);
      toast.success("Expense deleted.", {
        action: {
          label: "Undo",
          onClick: () => {
            restoreMutation.mutate(deleted, {
              onSuccess: () => toast.success("Expense restored."),
              onError: () => toast.error("That expense could not be restored."),
            });
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The expense could not be deleted.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Every cup, snack and daily total — grouped, searchable and yours."
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/add">
              <Plus className="size-3.5" aria-hidden="true" />
              Add expense
            </Link>
          </Button>
        }
      />

      <div className="mb-4 space-y-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search items or notes…"
            ariaLabel="Search expenses"
            className="sm:flex-1"
          />
          <div className="flex items-center gap-2">
            <Select
              value={month}
              onValueChange={(value) => {
                setMonth(value);
                setFilters((current) => ({ ...current, from: "", to: "" }));
              }}
            >
              <SelectTrigger className="min-w-0 flex-1 sm:w-[185px]" aria-label="Filter by month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {monthOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {monthLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="shrink-0 gap-2 px-3.5"
              onClick={() => setFilterOpen(true)}
              aria-label="Open expense filters"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Filters</span>
              {advancedCount > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-espresso text-[10px] font-semibold text-ivory">
                  {advancedCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        {advancedCount > 0 || month !== "all" || search ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.from ? (
              <FilterChip
                label={`${formatDateShort(filters.from)} – ${formatDateMedium(filters.to)}`}
                onClear={() => setFilters((current) => ({ ...current, from: "", to: "" }))}
              />
            ) : month !== "all" ? (
              <FilterChip label={monthLabel(month)} onClear={() => setMonth("all")} />
            ) : null}
            {activeCategory ? (
              <FilterChip
                label={activeCategory.name}
                onClear={() => setFilters((current) => ({ ...current, categoryId: "all" }))}
              />
            ) : null}
            {activeItem ? (
              <FilterChip
                label={activeItem.name}
                onClear={() => setFilters((current) => ({ ...current, itemId: "all" }))}
              />
            ) : null}
            {filters.sort !== "date-desc" ? (
              <FilterChip
                label={sortLabels[filters.sort]}
                onClear={() => setFilters((current) => ({ ...current, sort: "date-desc" }))}
              />
            ) : null}
            {hasAnyFilter ? (
              <button
                type="button"
                onClick={clearEverything}
                className="ml-0.5 text-[10.5px] font-medium text-mocha underline-offset-2 hover:text-espresso hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Expense totals"
        className="mb-4 grid grid-cols-3 divide-x divide-line/70 rounded-2xl border border-line bg-cream/25 px-1 py-3"
      >
        <div className="min-w-0 px-3">
          <p className="text-[9.5px] font-medium uppercase tracking-[0.11em] text-mocha">Total</p>
          <p className="amount mt-1 truncate text-[17px] font-semibold text-espresso sm:text-[19px]">
            {formatMoney(summary.amount, { currency })}
          </p>
        </div>
        <div className="min-w-0 px-3">
          <p className="text-[9.5px] font-medium uppercase tracking-[0.11em] text-mocha">Entries</p>
          <p className="amount mt-1 text-[17px] font-semibold text-espresso sm:text-[19px]">
            {summary.entries}
          </p>
        </div>
        <div className="min-w-0 px-3">
          <p className="text-[9.5px] font-medium uppercase tracking-[0.11em] text-mocha">Items</p>
          <p className="amount mt-1 text-[17px] font-semibold text-espresso sm:text-[19px]">
            {formatQuantity(summary.quantity)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-[13px] text-mocha">Opening your ledger…</Card>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          eyebrow="A clean slate"
          title="Your first expense starts here."
          description="Import your 2026 workbook or add a quick entry. Every total on this page comes from what you save."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link to="/data?sample=1">Import 2026 tracker</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/add">Add expense</Link>
              </Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nothing matches those filters."
          description="Try another month, loosen the date range, or clear the filters to see everything again."
          action={
            <Button variant="outline" onClick={clearEverything}>
              Clear all filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="md:hidden">
            {filters.sort === "amount-desc" || filters.sort === "amount-asc" ? (
              <Card className="overflow-hidden divide-y divide-line/70">
                {sortedExpenses.map((expense) => {
                  const first = expense.items[0]?.item_name_snapshot ?? "Expense";
                  const more = expense.items.length - 1;
                  return (
                    <Link
                      key={expense.id}
                      to={`/expenses/${expense.id}/edit`}
                      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#FDF9F2]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-mocha">
                          <CalendarDays className="size-3" aria-hidden="true" />
                          {formatDateMedium(expense.expense_date)}
                        </p>
                        <p className="mt-1 truncate text-[13px] font-medium text-espresso">
                          {first}
                          {more > 0 ? ` + ${more} more` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-mocha">
                          {formatQuantity(expenseQuantity(expense))} items
                        </p>
                      </div>
                      <p className="amount shrink-0 text-[13.5px] font-semibold text-espresso">
                        {formatMoney(expenseTotal(expense), { currency })}
                      </p>
                    </Link>
                  );
                })}
              </Card>
            ) : (
              groups.map((group) => (
                <div key={group.date} className="mb-4">
                  <div className="mb-2 flex items-baseline justify-between px-0.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-mocha">
                      {dateGroupLabel(group.date)}
                    </p>
                    <p className="amount text-[11.5px] font-medium text-coffee">
                      {formatMoney(group.total, { currency })}
                    </p>
                  </div>
                  <Card className="divide-y divide-line/70 overflow-hidden">
                    {group.expenses.map((expense) => (
                      <div key={expense.id}>
                        {expense.items.map((line, index) => (
                          <Link
                            key={line.id}
                            to={`/expenses/${expense.id}/edit`}
                            className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[#FDF9F2]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-espresso">
                                {line.item_name_snapshot}
                              </p>
                              <p className="mt-0.5 text-[11px] text-mocha">
                                {formatQuantity(line.quantity)} × {formatRate(line.unit_rate, currency)}
                              </p>
                              {index === 0 && expense.note ? (
                                <p className="mt-0.5 truncate text-[10.5px] italic text-mocha/90">
                                  {expense.note}
                                </p>
                              ) : null}
                            </div>
                            <p className="amount shrink-0 text-[12.5px] font-medium text-espresso">
                              {formatMoney(line.line_total, { currency })}
                            </p>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </Card>
                </div>
              ))
            )}
          </div>

          <ExpenseTable
            rows={tableRows}
            currency={currency}
            onDelete={(expense) => setPendingDelete(expense)}
          />
        </>
      )}

      <ExpenseFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        categories={categories}
        items={items}
        onApply={(next) => {
          setMonth("all");
          setFilters(next);
        }}
        onReset={clearEverything}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this expense?"
        description={
          pendingDelete
            ? `This entry has ${pendingDelete.items.length} ${
                pendingDelete.items.length === 1 ? "item line" : "item lines"
              } and will be removed from your totals. You can undo it right after.`
            : ""
        }
        confirmLabel="Delete expense"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Pencil, Trash2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MonthNavigator } from "@/components/shared/month-navigator";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FieldError, FieldHint, Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useBudgets, useDeleteBudget, useExpenses, useSaveBudget } from "@/hooks/queries";
import { budgetStatus, expensesInMonth } from "@/lib/analytics";
import { expenseTotal, expenseQuantity } from "@/features/expenses/rows";
import {
  currentMonthKey,
  monthKey,
  monthLabel,
  parseMonthKey,
} from "@/lib/dates";
import { currencySymbol, formatMoney, toPaise } from "@/lib/money";
import { budgetFormSchema, type BudgetFormValues } from "@/lib/validations";
import type { MonthlyBudget } from "@/types/domain";

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetMonth: string;
  existing?: MonthlyBudget;
}

function BudgetDialog({ open, onOpenChange, budgetMonth, existing }: BudgetDialogProps) {
  const { workspace, currency } = useWorkspaceContext();
  const saveBudget = useSaveBudget(workspace.id);
  const { year, month } = parseMonthKey(budgetMonth);

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: { amountRupees: 0 },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amountRupees: existing ? existing.budget_amount / 100 : 0,
      });
    }
  }, [open, existing, form]);

  const onSubmit = async (values: BudgetFormValues) => {
    try {
      await saveBudget.mutateAsync({
        year,
        month,
        amount: toPaise(values.amountRupees),
      });
      toast.success(
        existing
          ? `${monthLabel(budgetMonth)} budget updated.`
          : `${monthLabel(budgetMonth)} budget set.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The budget could not be saved.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit monthly budget" : "Set a monthly budget"}</DialogTitle>
          <DialogDescription>
            {monthLabel(budgetMonth)}. Budgets are optional and only for your own reference.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="budget-amount">Budget amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-mocha">
                {currencySymbol(currency)}
              </span>
              <Input
                id="budget-amount"
                type="number"
                inputMode="decimal"
                min={1}
                step="1"
                placeholder="e.g. 2500"
                className="pl-8"
                aria-invalid={Boolean(form.formState.errors.amountRupees)}
                {...form.register("amountRupees", { valueAsNumber: true })}
              />
            </div>
            <FieldHint>You can change or remove it at any time.</FieldHint>
            <FieldError>{form.formState.errors.amountRupees?.message}</FieldError>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveBudget.isPending} disabled={saveBudget.isPending}>
              {existing ? "Save budget" : "Set budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BudgetsPage() {
  const { workspace, currency } = useWorkspaceContext();
  const { data: budgets = [] } = useBudgets(workspace.id);
  const { data: expenses = [] } = useExpenses(workspace.id);
  const deleteBudget = useDeleteBudget(workspace.id);
  const saveBudget = useSaveBudget(workspace.id);

  const [budgetMonth, setBudgetMonth] = useState(currentMonthKey());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { year, month } = parseMonthKey(budgetMonth);
  const budget = budgets.find((entry) => entry.year === year && entry.month === month);
  const monthExpenses = useMemo(
    () => expensesInMonth(expenses, budgetMonth),
    [expenses, budgetMonth],
  );
  const spent = monthExpenses.reduce((total, expense) => total + expenseTotal(expense), 0);
  const quantity = monthExpenses.reduce(
    (total, expense) => total + expenseQuantity(expense),
    0,
  );
  const status = budgetStatus(spent, budget?.budget_amount ?? 0);

  const history = useMemo(() => {
    return budgets
      .map((entry) => {
        const key = monthKey(entry.year, entry.month);
        const monthlyExpenses = expensesInMonth(expenses, key);
        const monthlySpent = monthlyExpenses.reduce(
          (total, expense) => total + expenseTotal(expense),
          0,
        );
        return {
          budget: entry,
          key,
          spent: monthlySpent,
          status: budgetStatus(monthlySpent, entry.budget_amount),
        };
      })
      .sort((left, right) => right.key.localeCompare(left.key))
      .slice(0, 8);
  }, [budgets, expenses]);

  const removeBudget = async () => {
    if (!budget) return;
    const removed = budget;
    try {
      await deleteBudget.mutateAsync(budget.id);
      setConfirmRemove(false);
      toast.success("Budget removed.", {
        description: "Your expenses are untouched.",
        action: {
          label: "Undo",
          onClick: () => {
            saveBudget.mutate(
              {
                year: removed.year,
                month: removed.month,
                amount: removed.budget_amount,
              },
              {
                onSuccess: () => toast.success("Budget restored."),
                onError: () => toast.error("The budget could not be restored."),
              },
            );
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The budget could not be removed.");
    }
  };

  const toneColor =
    status.tone === "over"
      ? "bg-terracotta"
      : status.tone === "warning"
        ? "bg-caramel"
        : "bg-sage";

  return (
    <div>
      <PageHeader
        title="Monthly budgets"
        description="An optional gentle ceiling for the month. No guilt, just a clearer picture."
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            {budget ? "Edit budget" : "Set a budget"}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <MonthNavigator value={budgetMonth} onChange={setBudgetMonth} />
        {budgetMonth !== currentMonthKey() ? (
          <button
            type="button"
            onClick={() => setBudgetMonth(currentMonthKey())}
            className="text-[11.5px] font-medium text-coffee underline-offset-2 hover:text-espresso hover:underline"
          >
            Back to this month
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-mocha">
                    {monthLabel(budgetMonth)}
                  </p>
                  <h2 className="mt-1 text-[16px] font-semibold text-espresso">
                    {budget ? "Budget remaining" : "Spending this month"}
                  </h2>
                </div>
                <span className="flex size-9 items-center justify-center rounded-full bg-parchment text-coffee">
                  <Wallet className="size-4" aria-hidden="true" />
                </span>
              </div>

              {budget ? (
                <>
                  <p className="amount mt-3 text-[38px] font-semibold leading-none tracking-[-0.04em] text-espresso">
                    {formatMoney(Math.abs(status.remaining), { currency })}
                    <span className="ml-1.5 text-[13px] font-normal text-mocha">
                      {status.remaining < 0 ? "over" : "left"}
                    </span>
                  </p>
                  <Progress
                    value={status.barPercent}
                    className="mt-5 h-2.5"
                    barClassName={toneColor}
                    label="Budget used this month"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-mocha">
                    <span>{status.percentUsed}% used</span>
                    <span>{formatMoney(status.spent, { currency })} of {formatMoney(status.budget, { currency })}</span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 divide-x divide-line/70 rounded-xl border border-line bg-[#FDF9F2] px-1 py-3">
                    <div className="min-w-0 px-3">
                      <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">
                        Spent
                      </p>
                      <p className="amount mt-1 truncate text-[14px] font-semibold text-espresso">
                        {formatMoney(status.spent, { currency })}
                      </p>
                    </div>
                    <div className="min-w-0 px-3">
                      <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">
                        Budget
                      </p>
                      <p className="amount mt-1 truncate text-[14px] font-semibold text-espresso">
                        {formatMoney(status.budget, { currency })}
                      </p>
                    </div>
                    <div className="min-w-0 px-3">
                      <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">
                        Items
                      </p>
                      <p className="amount mt-1 text-[14px] font-semibold text-espresso">
                        {quantity}
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      status.tone === "on-track"
                        ? "mt-4 flex items-start gap-2 rounded-xl bg-[#EDF1E8]/80 px-3 py-2.5 text-[11.5px] leading-relaxed text-sage-deep"
                        : "mt-4 flex items-start gap-2 rounded-xl bg-[#F8E4DC]/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-[#8E4C33]"
                    }
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {status.tone === "over"
                      ? `You’ve gone ${formatMoney(Math.abs(status.remaining), { currency })} over this month’s budget.`
                      : status.tone === "warning"
                        ? `You’re nearing your ceiling — ${formatMoney(status.remaining, { currency })} left.`
                        : `${formatMoney(status.remaining, { currency })} still available this month.`}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                      Edit budget
                    </Button>
                    <Button
                      variant="ghost-danger"
                      size="sm"
                      onClick={() => setConfirmRemove(true)}
                      className="gap-1.5"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-2">
                  <p className="amount text-[38px] font-semibold leading-none tracking-[-0.04em] text-espresso">
                    {formatMoney(spent, { currency })}
                  </p>
                  <p className="mt-2 text-[12px] text-mocha">
                    {monthExpenses.length} entries · {quantity} items this month
                  </p>
                  <div className="mt-5 rounded-xl border border-dashed border-cream-deep/70 bg-[#FDF9F2] px-4 py-4">
                    <p className="text-[13px] font-medium text-espresso">
                      No budget set for {monthLabel(budgetMonth)}.
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-mocha">
                      Add one if a monthly ceiling would help. It stays entirely optional.
                    </p>
                    <Button size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
                      Set a budget
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <p className="px-1 text-[10.5px] leading-relaxed text-mocha">
            Budgets are calculated from the transactions saved in this workspace. They don’t
            affect any expense amounts.
          </p>
        </div>

        <div>
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold text-espresso">Budget history</h2>
            <p className="mt-0.5 text-[11.5px] text-mocha">Recent monthly ceilings and usage.</p>
            {history.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[11.5px] leading-relaxed text-mocha">
                Once you set a budget, you’ll see how each month compared here.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {history.map((entry) => (
                  <li key={entry.budget.id}>
                    <button
                      type="button"
                      onClick={() => setBudgetMonth(entry.key)}
                      className="w-full rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-parchment/60"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium text-espresso">
                          {monthLabel(entry.key)}
                        </span>
                        <span className="text-[10.5px] text-mocha">
                          {entry.status.percentUsed}%
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Progress
                          value={entry.status.barPercent}
                          className="h-1.5"
                          barClassName={
                            entry.status.tone === "over"
                              ? "bg-terracotta"
                              : entry.status.tone === "warning"
                                ? "bg-caramel"
                                : "bg-sage"
                          }
                          label={`${monthLabel(entry.key)} budget used`}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-mocha">
                        {formatMoney(entry.spent, { currency })} of{" "}
                        {formatMoney(entry.budget.budget_amount, { currency })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budgetMonth={budgetMonth}
        existing={budget}
      />

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove this budget?"
        description={`The budget for ${monthLabel(budgetMonth)} will be removed. Your expenses and totals stay exactly as they are.`}
        confirmLabel="Remove budget"
        destructive
        onConfirm={() => void removeBudget()}
      />
    </div>
  );
}

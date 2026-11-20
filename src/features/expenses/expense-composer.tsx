import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  ImagePlus,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { DateField } from "@/components/shared/date-field";
import { SearchInput } from "@/components/shared/search-input";
import { ItemDialog } from "@/features/items/item-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useBudgets,
  useCategories,
  useCreateExpense,
  useDeleteReceipt,
  useExpenses,
  useItems,
  useReceipt,
  useSaveReceipt,
  useUpdateExpense,
} from "@/hooks/queries";
import { DEFAULT_ITEMS, MAX_QUANTITY } from "@/lib/constants";
import { categoryTheme } from "@/lib/category-meta";
import { itemFrequency } from "@/lib/analytics";
import { monthLabel, todayISO } from "@/lib/dates";
import { prepareReceiptImage } from "@/lib/images";
import { formatMoney, formatMoneyInput, formatQuantity, formatRate, parseAmountToPaise, currencySymbol } from "@/lib/money";
import { expenseSchema } from "@/lib/validations";
import { cn, newId } from "@/lib/utils";
import type { Expense, Item } from "@/types/domain";

interface DraftLine {
  key: string;
  itemId: string;
  name: string;
  categoryName: string;
  unit: string;
  quantity: number;
  rateInput: string;
}

interface ExpenseComposerProps {
  mode?: "create" | "edit";
  initialExpense?: Expense;
  onSaved?: () => void;
}

const defaultItemOrder = new Map(DEFAULT_ITEMS.map((item, index) => [item.name, index]));

function lineAmount(line: DraftLine): number {
  const rate = parseAmountToPaise(line.rateInput);
  if (rate === null || rate < 0) return 0;
  return Math.round(line.quantity * rate);
}

export function ExpenseComposer({
  mode = "create",
  initialExpense,
  onSaved,
}: ExpenseComposerProps) {
  const { workspace, actorId, currency } = useWorkspaceContext();
  const { data: items = [] } = useItems(workspace.id);
  const { data: categories = [] } = useCategories(workspace.id);
  const { data: expenses = [] } = useExpenses(workspace.id);
  const { data: budgets = [] } = useBudgets(workspace.id);
  const createExpense = useCreateExpense(workspace.id, actorId);
  const updateExpense = useUpdateExpense(workspace.id);
  const existingReceipt = useReceipt(mode === "edit" ? initialExpense?.id ?? null : null);
  const saveReceipt = useSaveReceipt(workspace.id);
  const deleteReceipt = useDeleteReceipt();

  const [date, setDate] = useState(initialExpense?.expense_date ?? todayISO());
  const [note, setNote] = useState(initialExpense?.note ?? "");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptChoice, setReceiptChoice] = useState<{
    blob: Blob;
    mimeType: string;
  } | null>(null);
  const [receiptRemoved, setReceiptRemoved] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const receiptSource =
    receiptChoice?.blob ??
    (receiptRemoved ? null : existingReceipt.data?.blob ?? null);

  useEffect(() => {
    if (!receiptSource) {
      setReceiptPreview(null);
      return;
    }
    const url = URL.createObjectURL(receiptSource);
    setReceiptPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptSource]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!initialExpense) return [];
    return initialExpense.items.map((line) => {
      const item = items.find((entry) => entry.id === line.item_id);
      const category = item ? categoryById.get(item.category_id) : undefined;
      return {
        key: line.id,
        itemId: line.item_id,
        name: line.item_name_snapshot,
        categoryName: category?.name ?? "Other",
        unit: item?.unit ?? "piece",
        quantity: line.quantity,
        rateInput: formatMoneyInput(line.unit_rate),
      };
    });
  });

  const frequency = useMemo(() => itemFrequency(expenses), [expenses]);

  const activeItems = useMemo(() => {
    const activeCategoryIds = new Set(
      categories.filter((category) => category.is_active).map((category) => category.id),
    );
    return items
      .filter((item) => item.is_active && activeCategoryIds.has(item.category_id))
      .sort((left, right) => {
        const frequencyOrder = (frequency.get(right.id) ?? 0) - (frequency.get(left.id) ?? 0);
        if (frequencyOrder !== 0) return frequencyOrder;
        const leftDefault = defaultItemOrder.get(left.name) ?? 99;
        const rightDefault = defaultItemOrder.get(right.name) ?? 99;
        if (leftDefault !== rightDefault) return leftDefault - rightDefault;
        return left.name.localeCompare(right.name);
      });
  }, [items, frequency, categories]);

  const availableCategories = useMemo(
    () => categories.filter((category) => activeItems.some((item) => item.category_id === category.id)),
    [categories, activeItems],
  );

  const usuals = useMemo(
    () => activeItems.filter((item) => (frequency.get(item.id) ?? 0) > 0).slice(0, 3),
    [activeItems, frequency],
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeItems.filter((item) => {
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      return !term || item.name.toLowerCase().includes(term);
    });
  }, [activeItems, categoryFilter, search]);

  const quantityByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      map.set(line.itemId, (map.get(line.itemId) ?? 0) + line.quantity);
    }
    return map;
  }, [lines]);

  const totalAmount = lines.reduce((total, line) => total + lineAmount(line), 0);
  const totalQuantity = lines.reduce((total, line) => total + line.quantity, 0);
  const hasInvalidRate = lines.some((line) => {
    const parsed = parseAmountToPaise(line.rateInput);
    return parsed === null || parsed < 0;
  });
  const isSaving = isSubmitting || createExpense.isPending || updateExpense.isPending;

  const addItem = (item: Item) => {
    const categoryName = categoryById.get(item.category_id)?.name ?? "Other";
    setLines((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (existing) {
        return current.map((line) =>
          line.key === existing.key
            ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + 1) }
            : line,
        );
      }
      return [
        ...current,
        {
          key: newId(),
          itemId: item.id,
          name: item.name,
          categoryName,
          unit: item.unit,
          quantity: 1,
          rateInput: formatMoneyInput(item.default_rate),
        },
      ];
    });
    setSaveError(null);
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const reset = () => {
    setLines([]);
    setNote("");
    setDate(todayISO());
    setSearch("");
    setCategoryFilter("all");
    setSaveError(null);
    setReceiptChoice(null);
    setReceiptRemoved(false);
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  };

  const chooseReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setReceiptBusy(true);
    try {
      const prepared = await prepareReceiptImage(file);
      setReceiptChoice(prepared);
      setReceiptRemoved(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That photo could not be prepared.",
      );
    } finally {
      setReceiptBusy(false);
    }
  };

  const removeReceipt = () => {
    setReceiptChoice(null);
    setReceiptRemoved(true);
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  };

  const persistReceipt = async (expenseId: string) => {
    try {
      if (receiptChoice) {
        await saveReceipt.mutateAsync({
          expenseId,
          blob: receiptChoice.blob,
          mimeType: receiptChoice.mimeType,
        });
      } else if (receiptRemoved && mode === "edit") {
        await deleteReceipt.mutateAsync(expenseId);
      }
    } catch (error) {
      toast.error("The expense was saved, but its receipt photo could not be stored.", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const nudgeBudget = (expenseDate: string) => {
    const month = expenseDate.slice(0, 7);
    const budget = budgets.find(
      (entry) => `${entry.year}-${String(entry.month).padStart(2, "0")}` === month,
    );
    if (!budget || budget.budget_amount <= 0) return;

    const spentBefore = expenses
      .filter((expense) => expense.expense_date.slice(0, 7) === month)
      .reduce(
        (sum, expense) =>
          sum + expense.items.reduce((lineSum, line) => lineSum + line.line_total, 0),
        0,
      );
    const spentAfter = spentBefore + totalAmount;
    const beforePercent = Math.round((spentBefore / budget.budget_amount) * 100);
    const afterPercent = Math.round((spentAfter / budget.budget_amount) * 100);
    if (beforePercent >= 80 || afterPercent < 80) return;

    toast.warning(
      afterPercent >= 100
        ? `${monthLabel(month)} is now over budget`
        : `80% of the ${monthLabel(month)} budget used`,
      {
        description:
          afterPercent >= 100
            ? `${formatMoney(spentAfter - budget.budget_amount, { currency })} over the ${formatMoney(budget.budget_amount, { currency })} budget.`
            : `${formatMoney(budget.budget_amount - spentAfter, { currency })} left of ${formatMoney(budget.budget_amount, { currency })}.`,
        duration: 6500,
      },
    );
  };

  const handleSave = async () => {
    if (submittingRef.current) return;
    if (lines.length === 0) {
      setSaveError("Add at least one item to your tray.");
      return;
    }

    const parsed = expenseSchema.safeParse({
      expenseDate: date,
      note,
      items: lines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitRate: parseAmountToPaise(line.rateInput) ?? -1,
      })),
    });

    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Check the entry and try again.");
      return;
    }
    setSaveError(null);
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (mode === "edit" && initialExpense) {
        await updateExpense.mutateAsync({ id: initialExpense.id, input: parsed.data });
        await persistReceipt(initialExpense.id);
        toast.success("Expense updated.");
        onSaved?.();
      } else {
        const created = await createExpense.mutateAsync(parsed.data);
        await persistReceipt(created.id);
        toast.success(`Expense saved · ${formatMoney(totalAmount, { currency })}`, {
          description: "Ready for the next cup.",
        });
        nudgeBudget(parsed.data.expenseDate);
        reset();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The expense could not be saved.";
      setSaveError(message);
      toast.error(message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="pb-[92px] lg:pb-0"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
      noValidate
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="grid gap-3.5 sm:grid-cols-[190px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor="expense-date">Date</Label>
                <div className="flex gap-2">
                  <DateField
                    id="expense-date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="min-w-0 flex-1"
                  />
                  {date !== todayISO() ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 shrink-0 px-3 text-[12px]"
                      onClick={() => setDate(todayISO())}
                    >
                      Today
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-note">
                  Note <span className="font-normal text-mocha">(optional)</span>
                </Label>
                <Input
                  id="expense-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. evening chai with the team"
                  maxLength={240}
                  autoComplete="off"
                />
              </div>
            </div>
          </Card>

          <AnimatePresence initial={false}>
            {lines.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[13.5px] font-semibold text-espresso">Your tray</h2>
                      <span className="rounded-full bg-cream/60 px-2 py-0.5 text-[10px] font-medium text-espresso">
                        {formatQuantity(totalQuantity)} items
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLines([])}
                      className="text-[11.5px] font-medium text-mocha transition-colors hover:text-terracotta"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="divide-y divide-line/70">
                    <AnimatePresence initial={false}>
                      {lines.map((line) => {
                        const rate = parseAmountToPaise(line.rateInput);
                        const invalid = rate === null || rate < 0;
                        const theme = categoryTheme(line.categoryName);
                        return (
                          <motion.li
                            key={line.key}
                            layout
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-4 py-3 sm:px-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[13.5px] font-medium text-espresso">
                                  {line.name}
                                </p>
                                <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-mocha">
                                  <span
                                    className="size-1.5 rounded-full"
                                    style={{ backgroundColor: theme.hex }}
                                    aria-hidden="true"
                                  />
                                  {line.categoryName} · per {line.unit}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <p className="amount text-[14px] font-semibold text-espresso">
                                  {formatMoney(lineAmount(line), { currency })}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => removeLine(line.key)}
                                  className="ml-1 flex size-8 items-center justify-center rounded-full text-mocha transition-colors hover:bg-[#F8E4DC] hover:text-terracotta"
                                  aria-label={`Remove ${line.name}`}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between gap-3">
                              <label className="flex h-9 items-center gap-1 rounded-full border border-line bg-ivory/70 px-2.5 focus-within:border-caramel">
                                <span className="text-[11px] text-mocha">{currencySymbol(currency)}</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={line.rateInput}
                                  onChange={(event) =>
                                    updateLine(line.key, {
                                      rateInput: event.target.value.replace(/[^\d.]/g, "").slice(0, 8),
                                    })
                                  }
                                  onFocus={(event) => event.currentTarget.select()}
                                  className={cn(
                                    "amount w-12 border-0 bg-transparent p-0 text-[12px] font-medium text-espresso focus:outline-none",
                                    invalid && "text-terracotta",
                                  )}
                                  aria-label={`Rate for ${line.name}`}
                                  aria-invalid={invalid}
                                />
                                <span className="text-[10px] text-mocha">rate</span>
                              </label>
                              <QuantityStepper
                                value={line.quantity}
                                onChange={(quantity) => updateLine(line.key, { quantity })}
                                itemName={line.name}
                                compact
                              />
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-espresso">Pick your items</h2>
                <p className="mt-0.5 text-[11.5px] text-mocha">
                  Tap to add. Rates are prefilled and editable.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setNewItemName(search.trim());
                  setItemDialogOpen(true);
                }}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                New item
              </Button>
            </div>

            {usuals.length > 0 && lines.length === 0 ? (
              <div className="mt-4 rounded-xl border border-cream-deep/50 bg-[#FDF9F2] p-3">
                <div className="flex items-baseline justify-between gap-2 px-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-mocha">
                    Your usuals
                  </p>
                  <p className="text-[9.5px] text-mocha">Tap, then save</p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {usuals.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className="flex min-h-12 items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-1.5 text-left transition-colors hover:border-cream-deep active:scale-[0.98]"
                      aria-label={`Add your usual ${item.name} at ${formatRate(item.default_rate, currency)}`}
                    >
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-parchment text-coffee"
                        aria-hidden="true"
                      >
                        <Plus className="size-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium leading-tight text-espresso">
                          {item.name}
                        </span>
                        <span className="amount mt-0.5 block text-[9.5px] text-mocha">
                          {formatRate(item.default_rate, currency)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search tea, coffee, snacks…"
                ariaLabel="Search items"
              />
            </div>

            <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-[11.5px] font-medium transition-colors",
                  categoryFilter === "all"
                    ? "border-espresso bg-espresso text-ivory"
                    : "border-line bg-white text-coffee hover:border-cream-deep",
                )}
              >
                All items
              </button>
              {availableCategories.map((category) => {
                const theme = categoryTheme(category.name);
                const active = categoryFilter === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryFilter(category.id)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-medium transition-colors",
                      active
                        ? "border-espresso bg-espresso text-ivory"
                        : "border-line bg-white text-coffee hover:border-cream-deep",
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: active ? "#E9D7B9" : theme.hex }}
                      aria-hidden="true"
                    />
                    {category.name}
                  </button>
                );
              })}
            </div>

            {filteredItems.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-cream-deep/70 px-5 py-7 text-center">
                {search.trim() ? (
                  <>
                    <p className="text-[13px] font-medium text-espresso">
                      No items match “{search.trim()}”.
                    </p>
                    <p className="mt-1 text-[11.5px] text-mocha">
                      Add it to your catalogue and use it right away.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setNewItemName(search.trim());
                        setItemDialogOpen(true);
                      }}
                    >
                      Create “{search.trim()}”
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-espresso">No active items here yet.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setItemDialogOpen(true)}
                    >
                      Add an item
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const category = categoryById.get(item.category_id);
                  const theme = categoryTheme(category?.name);
                  const quantity = quantityByItem.get(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      aria-label={`Add ${item.name}, ${formatRate(item.default_rate, currency)}`}
                      className={cn(
                        "group flex min-h-[92px] flex-col justify-between rounded-2xl border bg-white p-3 text-left transition-all duration-200 active:scale-[0.985]",
                        quantity
                          ? "border-caramel/60 shadow-[0_0_0_1px_rgba(197,139,82,0.25)]"
                          : "border-line hover:border-cream-deep hover:shadow-card",
                      )}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">
                          {category?.name ?? "Other"}
                        </span>
                        {quantity ? (
                          <span className="flex min-w-5 items-center justify-center rounded-full bg-espresso px-1.5 py-0.5 text-[10px] font-semibold text-ivory">
                            ×{quantity}
                          </span>
                        ) : (
                          <span
                            className="flex size-5 items-center justify-center rounded-full"
                            style={{ backgroundColor: theme.soft, color: theme.deep }}
                          >
                            <Plus className="size-3" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <div className="mt-3 w-full">
                        <p className="truncate text-[13px] font-medium leading-tight text-espresso">
                          {item.name}
                        </p>
                        <p className="amount mt-1 text-[11px] text-mocha">
                          {formatRate(item.default_rate, currency)}
                          <span className="text-[9.5px]"> / {item.unit}</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-line/70 pt-3">
              <p className="flex items-center gap-1.5 text-[10.5px] text-mocha">
                <Sparkles className="size-3 text-caramel" aria-hidden="true" />
                Sorted by your usual picks
              </p>
              <Link
                to="/items"
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-coffee hover:text-espresso"
              >
                Manage rates <ChevronRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-espresso">
                  Receipt photo <span className="font-normal text-mocha">(optional)</span>
                </h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-mocha">
                  Snap the bill for this expense. It stays on this device, with the entry.
                </p>
              </div>
              {receiptPreview ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={removeReceipt}
                  aria-label="Remove receipt photo"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>

            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Attach a receipt photo"
              onChange={(event) => void chooseReceipt(event)}
            />

            {receiptPreview ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-line bg-[#FBF6EE]">
                <img
                  src={receiptPreview}
                  alt="Receipt attached to this expense"
                  className="max-h-56 w-full object-contain"
                />
                <div className="flex items-center justify-between gap-2 border-t border-line/70 px-3 py-2">
                  <p className="text-[10.5px] text-mocha">
                    {receiptChoice ? "New photo ready to save" : "Saved with this expense"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={receiptBusy}
                  >
                    Replace
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 bg-white"
                onClick={() => receiptInputRef.current?.click()}
                disabled={receiptBusy}
                isLoading={receiptBusy}
              >
                <ImagePlus className="size-3.5" aria-hidden="true" />
                {receiptBusy ? "Preparing photo…" : "Take or choose a photo"}
              </Button>
            )}
          </Card>

          {mode === "create" ? (
            <div className="flex items-center justify-center gap-3 text-[10.5px] text-mocha">
              <Link to="/expenses" className="hover:text-espresso">
                View expense history
              </Link>
              <span className="size-1 rounded-full bg-line" aria-hidden="true" />
              <Link to="/data" className="hover:text-espresso">
                Import a workbook
              </Link>
            </div>
          ) : null}
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-6">
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold text-espresso">
              {mode === "edit" ? "Update this expense" : "Save this expense"}
            </h2>
            <dl className="mt-4 space-y-2.5 text-[12px]">
              <div className="flex justify-between text-mocha">
                <dt>Items</dt>
                <dd className="amount text-espresso">{lines.length}</dd>
              </div>
              <div className="flex justify-between text-mocha">
                <dt>Total quantity</dt>
                <dd className="amount text-espresso">{formatQuantity(totalQuantity)}</dd>
              </div>
              <div className="flex justify-between border-t border-line/70 pt-3 text-coffee">
                <dt>Total</dt>
                <dd className="amount text-[20px] font-semibold text-espresso">
                  {formatMoney(totalAmount, { currency })}
                </dd>
              </div>
            </dl>

            {hasInvalidRate ? (
              <p role="alert" className="mt-3 rounded-lg bg-[#F8E4DC]/70 px-3 py-2 text-[11px] leading-snug text-[#8E4C33]">
                One or more rates aren’t valid. Enter a price of zero or more.
              </p>
            ) : null}
            {saveError ? (
              <p role="alert" className="mt-3 rounded-lg bg-[#F8E4DC]/70 px-3 py-2 text-[11px] leading-snug text-[#8E4C33]">
                {saveError}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="mt-4 w-full justify-between px-5"
              disabled={isSaving}
              isLoading={isSaving}
            >
              {mode === "edit" ? "Save changes" : "Save expense"}
              {!isSaving ? <Plus className="size-4" aria-hidden="true" /> : null}
            </Button>
            <Link
              to="/expenses"
              className="mt-3 block text-center text-[11.5px] font-medium text-mocha hover:text-espresso"
            >
              Cancel
            </Link>
            <p className="mt-4 flex items-start gap-2 border-t border-line/70 pt-3 text-[10.5px] leading-relaxed text-mocha">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-sage" aria-hidden="true" />
              Quantities and rates are saved with this entry. Future price changes won’t rewrite
              history.
            </p>
          </Card>
        </aside>
      </div>

      <div
        role="region"
        aria-label="Expense summary"
        className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 px-3 py-2.5 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0">
            <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-mocha">
              Total
            </p>
            <p className="amount truncate text-[19px] font-semibold leading-tight text-espresso">
              {formatMoney(totalAmount, { currency })}
            </p>
            <p className="text-[9.5px] text-mocha">{formatQuantity(totalQuantity)} items</p>
          </div>
          <Button
            type="submit"
            className="h-12 flex-1"
            disabled={isSaving || lines.length === 0}
            isLoading={isSaving}
          >
            {mode === "edit" ? "Save changes" : "Save expense"}
          </Button>
        </div>
        {saveError ? (
          <p role="alert" className="mx-auto mt-1.5 max-w-lg text-[10.5px] text-terracotta">
            {saveError}
          </p>
        ) : null}
      </div>

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        initialName={newItemName}
        defaultCategoryId={
          categoryFilter !== "all"
            ? categoryFilter
            : availableCategories[0]?.id ?? categories[0]?.id
        }
        onSaved={(item) => {
          addItem(item);
          setSearch("");
        }}
      />
    </form>
  );
}

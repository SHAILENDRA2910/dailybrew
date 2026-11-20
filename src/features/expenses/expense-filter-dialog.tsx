import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/shared/date-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Item } from "@/types/domain";

export type ExpenseSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export interface ExpenseFilters {
  from: string;
  to: string;
  categoryId: string;
  itemId: string;
  sort: ExpenseSort;
}

export const defaultExpenseFilters: ExpenseFilters = {
  from: "",
  to: "",
  categoryId: "all",
  itemId: "all",
  sort: "date-desc",
};

const sortOptions: { value: ExpenseSort; label: string }[] = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
];

interface ExpenseFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ExpenseFilters;
  categories: Category[];
  items: Item[];
  onApply: (filters: ExpenseFilters) => void;
  onReset: () => void;
}

export function ExpenseFilterDialog({
  open,
  onOpenChange,
  filters,
  categories,
  items,
  onApply,
  onReset,
}: ExpenseFilterDialogProps) {
  const [draft, setDraft] = useState<ExpenseFilters>(filters);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(filters);
      setError(null);
    }
  }, [open, filters]);

  const apply = () => {
    if (Boolean(draft.from) !== Boolean(draft.to)) {
      setError("Choose both a start and an end date, or leave both blank.");
      return;
    }
    if (draft.from && draft.to && draft.from > draft.to) {
      setError("The start date must come before the end date.");
      return;
    }
    setError(null);
    onApply(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter expenses</DialogTitle>
          <DialogDescription>
            Narrow the ledger by a date range, catalogue or sort order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-medium text-espresso">Custom date range</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="filter-from" className="text-[11.5px] text-mocha">
                  From
                </Label>
                <DateField
                  id="filter-from"
                  value={draft.from}
                  max={draft.to || undefined}
                  onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-to" className="text-[11.5px] text-mocha">
                  To
                </Label>
                <DateField
                  id="filter-to"
                  value={draft.to}
                  min={draft.from || undefined}
                  onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                />
              </div>
            </div>
            <p className="mt-1.5 text-[10.5px] text-mocha">
              A custom range replaces the month filter.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="filter-category" className="text-[12px]">
                Category
              </Label>
              <Select
                value={draft.categoryId}
                onValueChange={(value) => setDraft({ ...draft, categoryId: value })}
              >
                <SelectTrigger id="filter-category" aria-label="Filter by category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-item" className="text-[12px]">
                Item
              </Label>
              <Select
                value={draft.itemId}
                onValueChange={(value) => setDraft({ ...draft, itemId: value })}
              >
                <SelectTrigger id="filter-item" aria-label="Filter by item">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-sort" className="text-[12px]">
              Sort
            </Label>
            <Select
              value={draft.sort}
              onValueChange={(value) =>
                setDraft({ ...draft, sort: value as ExpenseSort })
              }
            >
              <SelectTrigger id="filter-sort" aria-label="Sort expenses">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-[#F8E4DC]/70 px-3 py-2 text-[11.5px] text-[#8E4C33]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-mocha"
            onClick={() => {
              setDraft(defaultExpenseFilters);
              setError(null);
              onReset();
              onOpenChange(false);
            }}
          >
            Clear all filters
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={apply}>
              Apply filters
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

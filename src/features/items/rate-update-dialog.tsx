import { ArrowUpDown, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { DateField } from "@/components/shared/date-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApplyRateChanges, useItems } from "@/hooks/queries";
import { todayISO } from "@/lib/dates";
import { currencySymbol, formatMoneyInput, formatRate, parseAmountToPaise } from "@/lib/money";

interface RateUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RateUpdateDialog({ open, onOpenChange }: RateUpdateDialogProps) {
  const { workspace, actorId, currency } = useWorkspaceContext();
  const { data: items = [] } = useItems(workspace.id);
  const applyRates = useApplyRateChanges(workspace.id, actorId);

  const [values, setValues] = useState<Record<string, string>>({});
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setValues({});
      setSearch("");
      setEffectiveDate(todayISO());
    }
  }, [open]);

  const activeItems = useMemo(
    () => items.filter((item) => item.is_active).sort((left, right) => left.name.localeCompare(right.name)),
    [items],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? activeItems.filter((item) => item.name.toLowerCase().includes(term))
      : activeItems;
  }, [activeItems, search]);

  const parsed = useMemo(() => {
    const changes: { itemId: string; newRate: number }[] = [];
    const invalid: string[] = [];
    for (const item of activeItems) {
      const raw = values[item.id];
      if (raw === undefined || raw.trim() === "") continue;
      const paise = parseAmountToPaise(raw);
      if (paise === null || paise < 0) {
        invalid.push(item.id);
        continue;
      }
      if (paise !== item.default_rate) changes.push({ itemId: item.id, newRate: paise });
    }
    return { changes, invalid };
  }, [activeItems, values]);

  const save = async () => {
    if (parsed.invalid.length > 0) {
      toast.error("One of the new rates isn’t a valid amount.");
      return;
    }
    if (parsed.changes.length === 0) return;
    try {
      const count = await applyRates.mutateAsync({
        changes: parsed.changes,
        effectiveDate,
      });
      toast.success(`${count} ${count === 1 ? "rate" : "rates"} updated.`, {
        description: "Past expenses keep the price they were saved with.",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The rates could not be updated.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Update rates</DialogTitle>
          <DialogDescription>
            Enter the new price for any item that changed. Only the fields you fill in are
            updated, and every change is recorded in that item’s rate history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mocha"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search items…"
                aria-label="Search items to update"
                className="pl-9"
              />
            </div>
            <div>
              <Label htmlFor="rate-effective-date" className="sr-only">
                Effective date
              </Label>
              <DateField
                id="rate-effective-date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                aria-label="Effective date"
              />
            </div>
          </div>

          <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-line">
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-mocha">
                No active items match that search.
              </p>
            ) : (
              <ul className="divide-y divide-line/70">
                {visible.map((item) => {
                  const raw = values[item.id] ?? "";
                  const invalid = parsed.invalid.includes(item.id);
                  return (
                    <li
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_86px_104px] items-center gap-2 px-3 py-2.5 sm:px-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-espresso">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-mocha">
                          Now {formatRate(item.default_rate, currency)} / {item.unit}
                        </p>
                      </div>
                      <p className="amount text-right text-[11.5px] text-mocha">
                        {formatRate(item.default_rate, currency)}
                      </p>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-mocha">
                          {currencySymbol(currency)}
                        </span>
                        <Input
                          value={raw}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [item.id]: event.target.value
                                .replace(/[^\d.]/g, "")
                                .slice(0, 9),
                            }))
                          }
                          inputMode="decimal"
                          placeholder={formatMoneyInput(item.default_rate)}
                          aria-label={`New rate for ${item.name}`}
                          aria-invalid={invalid}
                          className="h-9 pl-6 text-right text-[12px]"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-mocha">
            <ArrowUpDown className="mt-0.5 size-3 shrink-0 text-caramel" aria-hidden="true" />
            {parsed.changes.length === 0
              ? "Fill in a new rate to see the changes ready to apply."
              : `${parsed.changes.length} ${parsed.changes.length === 1 ? "rate" : "rates"} ready to apply. Saved expenses are untouched.`}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={parsed.changes.length === 0 || parsed.invalid.length > 0 || applyRates.isPending}
            isLoading={applyRates.isPending}
          >
            Apply {parsed.changes.length > 0 ? `${parsed.changes.length} ` : ""}
            {parsed.changes.length === 1 ? "change" : "changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { ArrowRight, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceContext } from "@/app/workspace-context";
import { usePriceHistory } from "@/hooks/queries";
import { formatDateMedium, formatDateTime } from "@/lib/dates";
import { formatRate } from "@/lib/money";
import type { Item } from "@/types/domain";

interface PriceHistoryDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceHistoryDialog({ item, open, onOpenChange }: PriceHistoryDialogProps) {
  const { currency } = useWorkspaceContext();
  const query = usePriceHistory(open && item ? item.id : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate history</DialogTitle>
          <DialogDescription>
            {item ? `${item.name} · currently ${formatRate(item.default_rate, currency)} per ${item.unit}` : ""}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (query.data?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-cream-deep/70 px-5 py-8 text-center">
            <History className="mx-auto size-5 text-mocha" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-medium text-espresso">No rate changes yet.</p>
            <p className="mt-1 text-[11.5px] text-mocha">
              This item is still on its original rate.
            </p>
          </div>
        ) : (
          <ul className="max-h-[50dvh] space-y-2 overflow-y-auto pr-1">
            {query.data?.map((entry) => {
              const increased = entry.new_rate > entry.old_rate;
              return (
                <li key={entry.id} className="rounded-xl border border-line bg-white px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[13px] text-espresso">
                      <span className="amount text-mocha">{formatRate(entry.old_rate, currency)}</span>
                      <ArrowRight className="size-3 text-mocha" aria-hidden="true" />
                      <span className="amount font-semibold">
                        {formatRate(entry.new_rate, currency)}
                      </span>
                    </p>
                    <Badge variant={increased ? "terracotta" : "sage"}>
                      {increased ? "Increase" : "Decrease"}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-mocha">
                    Effective {formatDateMedium(entry.effective_date)} · recorded{" "}
                    {formatDateTime(entry.created_at)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 rounded-xl bg-cream/30 px-3 py-2.5 text-[10.5px] leading-relaxed text-mocha">
          Saved expenses keep their own rate snapshot. Changing a default rate only affects new
          entries.
        </p>
      </DialogContent>
    </Dialog>
  );
}

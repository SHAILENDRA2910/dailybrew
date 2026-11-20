import { CalendarCheck, Lock, Printer, Unlock } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCloseMonth, useMonthClosures, useReopenMonth } from "@/hooks/queries";
import {
  formatDateMedium,
  monthLabel,
  monthLabelShort,
  shiftMonthKey,
} from "@/lib/dates";
import { formatMoney, formatQuantity } from "@/lib/money";

interface MonthCloseCardProps {
  month: string;
  total: number;
  entries: number;
  quantity: number;
}

export function MonthCloseCard({ month, total, entries, quantity }: MonthCloseCardProps) {
  const { workspace, currency } = useWorkspaceContext();
  const { data: closures = [] } = useMonthClosures(workspace.id);
  const closeMonth = useCloseMonth(workspace.id);
  const reopenMonth = useReopenMonth(workspace.id);

  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);

  const closure = closures.find((entry) => entry.month === month);
  const previous = closures.find((entry) => entry.month === shiftMonthKey(month, -1));
  const nextLabel = monthLabel(shiftMonthKey(month, 1));

  const close = async () => {
    try {
      await closeMonth.mutateAsync(month);
      toast.success(`${monthLabel(month)} closed.`, {
        description: `Closing total ${formatMoney(total, { currency })}. Edits are locked until you reopen it.`,
      });
      setConfirmClose(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The month could not be closed.");
    }
  };

  const reopen = async () => {
    try {
      await reopenMonth.mutateAsync(month);
      toast.success(`${monthLabel(month)} reopened.`, {
        description: "Expenses in this month can be edited again.",
      });
      setConfirmReopen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The month could not be reopened.");
    }
  };

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-parchment text-coffee">
            <CalendarCheck className="size-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-semibold text-espresso">Month-end close</h2>
              {closure ? (
                <Badge variant="sage">
                  <Lock className="size-3" aria-hidden="true" />
                  Closed
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Unlock className="size-3" aria-hidden="true" />
                  Open
                </Badge>
              )}
            </div>
            <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-mocha">
              {closure
                ? `${monthLabel(month)} was closed on ${formatDateMedium(closure.closed_at.slice(0, 10))}. Its total is fixed into ${nextLabel} as the carried closing figure.`
                : `Close ${monthLabel(month)} once the books look right. It locks adds, edits, deletes and imports for that month — reopen it whenever you need to.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/print?month=${month}&print=1`}>
              <Printer className="size-3.5" aria-hidden="true" />
              Printable summary
            </Link>
          </Button>
          {closure ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmReopen(true)}>
              <Unlock className="size-3.5" aria-hidden="true" />
              Reopen
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setConfirmClose(true)}
              disabled={entries === 0}
              title={entries === 0 ? "Add an expense before closing this month." : undefined}
            >
              <Lock className="size-3.5" aria-hidden="true" />
              Close month
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-line/70 rounded-xl border border-line bg-[#FDF9F2] px-1 py-3">
        <div className="min-w-0 px-3">
          <dt className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">
            {closure ? "Closing total" : "Month total"}
          </dt>
          <dd className="amount mt-1 truncate text-[14px] font-semibold text-espresso">
            {formatMoney(closure?.closing_total ?? total, { currency })}
          </dd>
        </div>
        <div className="min-w-0 px-3">
          <dt className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">Entries</dt>
          <dd className="amount mt-1 text-[14px] font-semibold text-espresso">
            {closure?.entry_count ?? entries}
          </dd>
        </div>
        <div className="min-w-0 px-3">
          <dt className="text-[9px] font-medium uppercase tracking-[0.1em] text-mocha">Items</dt>
          <dd className="amount mt-1 text-[14px] font-semibold text-espresso">
            {formatQuantity(quantity)}
          </dd>
        </div>
      </dl>

      {previous ? (
        <p className="mt-2.5 text-[10.5px] text-mocha">
          Carried from {monthLabelShort(previous.month)}:{" "}
          <span className="amount font-medium text-coffee">
            {formatMoney(previous.closing_total, { currency })}
          </span>
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`Close ${monthLabel(month)}?`}
        description={`Every expense in ${monthLabel(month)} becomes read-only, and the closing total of ${formatMoney(total, { currency })} is recorded. You can reopen the month from this card at any time.`}
        confirmLabel="Close month"
        onConfirm={() => void close()}
      />
      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title={`Reopen ${monthLabel(month)}?`}
        description="Expense entry, editing, deletion and imports will be allowed in this month again. The closing record is removed."
        confirmLabel="Reopen month"
        destructive
        onConfirm={() => void reopen()}
      />
    </Card>
  );
}

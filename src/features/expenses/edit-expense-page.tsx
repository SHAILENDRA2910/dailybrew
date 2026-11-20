import { ArrowLeft, ReceiptText, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpenseComposer } from "@/features/expenses/expense-composer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceContext } from "@/app/workspace-context";
import {
  useCategories,
  useDeleteExpense,
  useExpenses,
  useItems,
  useRestoreExpense,
} from "@/hooks/queries";
import { formatDateMedium } from "@/lib/dates";

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspace } = useWorkspaceContext();
  const expensesQuery = useExpenses(workspace.id);
  const itemsQuery = useItems(workspace.id);
  const categoriesQuery = useCategories(workspace.id);
  const deleteMutation = useDeleteExpense(workspace.id);
  const restoreMutation = useRestoreExpense(workspace.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isLoading =
    expensesQuery.isLoading || itemsQuery.isLoading || categoriesQuery.isLoading;
  const expense = expensesQuery.data?.find((entry) => entry.id === id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full rounded-[20px]" />
      </div>
    );
  }

  if (!expense) {
    return (
      <div>
        <PageHeader title="Expense not found" />
        <EmptyState
          icon={ReceiptText}
          title="This entry isn’t here anymore."
          description="It may have been deleted. Your other expenses are safe."
          action={
            <Button asChild>
              <Link to="/expenses">Back to expenses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      const deleted = await deleteMutation.mutateAsync(expense.id);
      setConfirmOpen(false);
      toast.success("Expense deleted.", {
        description: "You can put it back from this message.",
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
      navigate("/expenses", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The expense could not be deleted.");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={`${formatDateMedium(expense.expense_date)} · ${expense.items.length} ${
          expense.items.length === 1 ? "item" : "items"
        }`}
        title="Edit expense"
        description="Changes update this entry only. Other days keep their own totals."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/expenses">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      <ExpenseComposer
        mode="edit"
        initialExpense={expense}
        onSaved={() => navigate("/expenses", { replace: true })}
      />

      <Card className="mb-20 mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between lg:mb-0">
        <div>
          <p className="text-[13px] font-medium text-espresso">Delete this expense</p>
          <p className="mt-0.5 text-[11.5px] text-mocha">
            Removes the entry and its items from your totals.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost-danger"
          className="shrink-0 justify-center border border-[#F0D5CA] sm:justify-start"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete expense
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this expense?"
        description="The entry and its item lines will be removed from your ledger. You can undo this right after."
        confirmLabel="Delete expense"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

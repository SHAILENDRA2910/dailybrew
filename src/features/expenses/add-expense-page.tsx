import { PageHeader } from "@/components/shared/page-header";
import { ExpenseComposer } from "@/features/expenses/expense-composer";

export default function AddExpensePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Quick entry"
        title="Add expense"
        description="A few taps, an honest total. Change quantities and rates as you go."
      />
      <ExpenseComposer />
    </div>
  );
}

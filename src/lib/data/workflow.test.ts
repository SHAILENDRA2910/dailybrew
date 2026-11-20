import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "@/lib/db";
import { setupWorkspace, type SetupWorkspaceInput } from "@/lib/data/workspace";
import {
  applyRateChanges,
  listItems,
  listPriceHistory,
} from "@/lib/data/catalog";
import { listClosures, closeMonth, reopenMonth } from "@/lib/data/closures";
import {
  commitImportRows,
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from "@/lib/data/expenses";
import { listBudgets, saveBudget } from "@/lib/data/budgets";
import { buildBackup, parseBackupFile, restoreBackup } from "@/lib/data/backup";
import type { Item, WorkspaceState } from "@/types/domain";

const setup: SetupWorkspaceInput = {
  fullName: "Meera Test",
  workspaceName: "Locked Brew",
  timezone: "Asia/Kolkata",
  currency: "INR",
};

let state: WorkspaceState;
let tea: Item;

beforeEach(async () => {
  await resetDatabase();
  state = await setupWorkspace(setup);
  const items = await listItems(state.workspace.id);
  const found = items.find((item) => item.name === "Tea Medium");
  if (!found) throw new Error("Seed catalogue missing Tea Medium.");
  tea = found;
});

afterAll(async () => {
  await resetDatabase();
});

async function makeAugustExpense() {
  return createExpense(state.workspace.id, state.profile!.id, {
    expenseDate: "2026-08-12",
    note: "August chai",
    items: [{ itemId: tea.id, quantity: 2, unitRate: 1800 }],
  });
}

describe("month-end close", () => {
  it("records the closing total and blocks edits in the closed month", async () => {
    const expense = await makeAugustExpense();
    const closure = await closeMonth(state.workspace.id, "2026-08");

    expect(closure.closing_total).toBe(3600);
    expect(closure.entry_count).toBe(1);
    expect((await listClosures(state.workspace.id))[0]?.month).toBe("2026-08");

    await expect(makeAugustExpense()).rejects.toThrow(/closed/i);
    await expect(
      updateExpense(state.workspace.id, expense.id, {
        expenseDate: "2026-09-01",
        note: "Moved out",
        items: [{ itemId: tea.id, quantity: 1, unitRate: 1800 }],
      }),
    ).rejects.toThrow(/closed/i);
    await expect(deleteExpense(expense.id)).rejects.toThrow(/closed/i);
    await expect(
      commitImportRows(
        state.workspace.id,
        state.profile!.id,
        [
          {
            expenseDate: "2026-08-20",
            itemName: "Late import",
            categoryName: "Tea",
            quantity: 1,
            unitRate: 1800,
            fingerprint: "fp-aug",
          },
        ],
        { fileName: "august.xlsx", rejectedCount: 0 },
      ),
    ).rejects.toThrow(/closed/i);

    const open = await createExpense(state.workspace.id, state.profile!.id, {
      expenseDate: "2026-09-02",
      note: "Open month",
      items: [{ itemId: tea.id, quantity: 1, unitRate: 1800 }],
    });
    expect(open.expense_date).toBe("2026-09-02");

    await reopenMonth(state.workspace.id, "2026-08");
    expect(await listClosures(state.workspace.id)).toHaveLength(0);
    await deleteExpense(expense.id);
    expect(await listExpenses(state.workspace.id)).toHaveLength(1);
  });
});

describe("batch rate changes", () => {
  it("updates several rates, records history and leaves saved lines alone", async () => {
    const items = await listItems(state.workspace.id);
    const coffee = items.find((item) => item.name === "Milk Coffee");
    if (!coffee) throw new Error("Seed catalogue missing Milk Coffee.");

    const expense = await createExpense(state.workspace.id, state.profile!.id, {
      expenseDate: "2026-11-19",
      note: "",
      items: [{ itemId: tea.id, quantity: 1, unitRate: tea.default_rate }],
    });

    const updated = await applyRateChanges(
      state.workspace.id,
      [
        { itemId: tea.id, newRate: 2200 },
        { itemId: coffee.id, newRate: 3000 },
        { itemId: coffee.id, newRate: 3000 },
      ],
      "2026-11-20",
      state.profile!.id,
    );
    expect(updated).toBe(2);

    const refreshed = await listItems(state.workspace.id);
    expect(refreshed.find((item) => item.id === tea.id)?.default_rate).toBe(2200);
    expect(refreshed.find((item) => item.id === coffee.id)?.default_rate).toBe(3000);

    const history = await listPriceHistory(tea.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.effective_date).toBe("2026-11-20");
    expect(history[0]?.new_rate).toBe(2200);

    const stored = await listExpenses(state.workspace.id);
    expect(stored[0]?.id).toBe(expense.id);
    expect(stored[0]?.items[0]?.unit_rate).toBe(1800);
  });
});

describe("full backup", () => {
  it("round-trips entries, closures and budgets", async () => {
    await makeAugustExpense();
    await saveBudget(state.workspace.id, { year: 2026, month: 8, amount: 500000 });
    await closeMonth(state.workspace.id, "2026-08");

    const backup = await buildBackup(state.workspace.id);
    const restoredFile = parseBackupFile(JSON.parse(JSON.stringify(backup)) as unknown);

    await resetDatabase();
    const restoredWorkspace = await restoreBackup(restoredFile);

    const expenses = await listExpenses(restoredWorkspace.id);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.note).toBe("August chai");

    const closures = await listClosures(restoredWorkspace.id);
    expect(closures[0]?.closing_total).toBe(3600);

    const budgets = await listBudgets(restoredWorkspace.id);
    expect(budgets[0]?.budget_amount).toBe(500000);
  });

  it("rejects a damaged backup instead of silently dropping rows", async () => {
    const backup = await buildBackup(state.workspace.id);
    const damaged = JSON.parse(JSON.stringify(backup)) as {
      data: { transaction_items: unknown[] };
    };
    damaged.data.transaction_items = [{ id: "only-an-id" }];
    expect(() => parseBackupFile(damaged)).toThrow(/damaged/i);
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "@/lib/db";
import { setupWorkspace, type SetupWorkspaceInput } from "@/lib/data/workspace";
import { listItems, updateItem, listPriceHistory } from "@/lib/data/catalog";
import {
  commitImportRows,
  createExpense,
  deleteExpense,
  getExistingFingerprints,
  getExpense,
  listExpenses,
  restoreExpense,
  updateExpense,
} from "@/lib/data/expenses";
import type { Item, WorkspaceState } from "@/types/domain";

const setup: SetupWorkspaceInput = {
  fullName: "Aarav Test",
  workspaceName: "Test Brew",
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

describe("expense persistence", () => {
  it("stores multi-item lines atomically with integer paise totals", async () => {
    const created = await createExpense(state.workspace.id, state.profile!.id, {
      expenseDate: "2026-11-19",
      note: "Evening round",
      items: [
        { itemId: tea.id, quantity: 3, unitRate: 1800 },
        { itemId: tea.id, quantity: 2, unitRate: 1800 },
      ],
    });

    expect(created.items).toHaveLength(2);
    expect(created.items[0]?.line_total).toBe(5400);
    expect(created.items[1]?.line_total).toBe(3600);
    expect(created.items.every((line) => line.item_name_snapshot === "Tea Medium")).toBe(true);
    expect(created.note).toBe("Evening round");

    const stored = await getExpense(created.id);
    expect(stored?.items).toHaveLength(2);
    const expenses = await listExpenses(state.workspace.id);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.items.reduce((sum, line) => sum + line.line_total, 0)).toBe(9000);
  });

  it("never rewrites historical line prices when catalogue rates change", async () => {
    const before = await createExpense(state.workspace.id, state.profile!.id, {
      expenseDate: "2026-11-18",
      note: "",
      items: [{ itemId: tea.id, quantity: 2, unitRate: tea.default_rate }],
    });

    const updatedTea = await updateItem(
      state.workspace.id,
      tea.id,
      {
        name: tea.name,
        categoryId: tea.category_id,
        defaultRate: 2000,
        unit: tea.unit,
        isActive: tea.is_active,
      },
      state.profile!.id,
    );
    expect(updatedTea.default_rate).toBe(2000);

    const after = await createExpense(state.workspace.id, state.profile!.id, {
      expenseDate: "2026-11-19",
      note: "",
      items: [{ itemId: tea.id, quantity: 1, unitRate: updatedTea.default_rate }],
    });

    const historical = await getExpense(before.id);
    expect(historical?.items[0]?.unit_rate).toBe(1800);
    expect(after.items[0]?.unit_rate).toBe(2000);

    const history = await listPriceHistory(tea.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.old_rate).toBe(1800);
    expect(history[0]?.new_rate).toBe(2000);
  });

  it("edits the whole entry, preserves snapshots and supports delete with undo", async () => {
    const created = await createExpense(state.workspace.id, state.profile!.id, {
      expenseDate: "2026-11-17",
      note: "Lunch",
      items: [{ itemId: tea.id, quantity: 1, unitRate: 1800 }],
    });

    const edited = await updateExpense(state.workspace.id, created.id, {
      expenseDate: "2026-11-18",
      note: "Iced tea",
      items: [{ itemId: tea.id, quantity: 2, unitRate: 1800 }],
    });
    expect(edited.expense_date).toBe("2026-11-18");
    expect(edited.note).toBe("Iced tea");
    expect(edited.items).toHaveLength(1);
    expect(edited.items[0]?.line_total).toBe(3600);

    const deleted = await deleteExpense(created.id);
    expect(await listExpenses(state.workspace.id)).toHaveLength(0);
    expect(deleted.items[0]?.item_name_snapshot).toBe("Tea Medium");

    await restoreExpense(deleted);
    const restored = await listExpenses(state.workspace.id);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.items[0]?.line_total).toBe(3600);
  });

  it("skips duplicate workbook imports by fingerprint while creating new items", async () => {
    const rows = [
      {
        expenseDate: "2026-11-01",
        itemName: "Masala Chai",
        categoryName: "Tea",
        quantity: 2,
        unitRate: 2200,
        fingerprint: "fp-masala-1",
      },
    ];

    const first = await commitImportRows(state.workspace.id, state.profile!.id, rows, {
      fileName: "tracker.xlsx",
      rejectedCount: 0,
    });
    expect(first.imported).toBe(1);
    expect(first.itemsCreated).toBe(1);
    expect(first.categoriesCreated).toBe(0);

    const fingerprints = await getExistingFingerprints(state.workspace.id);
    expect(fingerprints.has("fp-masala-1")).toBe(true);

    const second = await commitImportRows(state.workspace.id, state.profile!.id, rows, {
      fileName: "tracker.xlsx",
      rejectedCount: 0,
    });
    expect(second.imported).toBe(0);
    expect(second.skippedDuplicates).toBe(1);

    const expenses = await listExpenses(state.workspace.id);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.items[0]?.item_name_snapshot).toBe("Masala Chai");
    expect(expenses[0]?.items[0]?.unit_rate).toBe(2200);
    expect(expenses[0]?.import_source).toBe("tracker.xlsx");
  });
});

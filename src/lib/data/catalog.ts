import { DEFAULT_CATEGORY_NAMES, MAX_RATE_RUPEES } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { isValidISODate, todayISO } from "@/lib/dates";
import { normalizeName, nowISO, newId } from "@/lib/utils";
import type { Category, CategoryInput, Item, ItemInput, ItemPriceHistory } from "@/types/domain";

const categoryOrder = new Map<string, number>(
  DEFAULT_CATEGORY_NAMES.map((name, index) => [name.toLowerCase(), index]),
);

export async function listCategories(
  workspaceId: string,
  includeInactive = true,
): Promise<Category[]> {
  const db = await getDb();
  const categories = await db.getAllFromIndex("categories", "workspace", workspaceId);
  return categories
    .filter((category) => includeInactive || category.is_active)
    .sort((left, right) => {
      const leftOrder = categoryOrder.get(left.name.toLowerCase()) ?? 99;
      const rightOrder = categoryOrder.get(right.name.toLowerCase()) ?? 99;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name);
    });
}

export async function listItems(workspaceId: string, includeInactive = true): Promise<Item[]> {
  const db = await getDb();
  const items = await db.getAllFromIndex("items", "workspace", workspaceId);
  return items
    .filter((item) => includeInactive || item.is_active)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function createCategory(
  workspaceId: string,
  input: CategoryInput,
): Promise<Category> {
  const db = await getDb();
  const name = normalizeName(input.name);
  if (!name) throw new Error("Give the category a name.");
  const existing = await listCategories(workspaceId);
  if (existing.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`“${name}” already exists.`);
  }
  const category: Category = {
    id: newId(),
    workspace_id: workspaceId,
    name,
    is_active: input.isActive ?? true,
    created_at: nowISO(),
  };
  await db.put("categories", category);
  return category;
}

export async function updateCategory(
  workspaceId: string,
  categoryId: string,
  patch: { name?: string; isActive?: boolean },
): Promise<Category> {
  const db = await getDb();
  const current = await db.get("categories", categoryId);
  if (!current || current.workspace_id !== workspaceId) {
    throw new Error("Category not found.");
  }
  const nextName = patch.name ? normalizeName(patch.name) : current.name;
  if (!nextName) throw new Error("Give the category a name.");
  const all = await listCategories(workspaceId);
  if (
    all.some(
      (category) =>
        category.id !== categoryId && category.name.toLowerCase() === nextName.toLowerCase(),
    )
  ) {
    throw new Error(`“${nextName}” already exists.`);
  }
  const updated: Category = {
    ...current,
    name: nextName,
    is_active: patch.isActive ?? current.is_active,
  };
  await db.put("categories", updated);
  return updated;
}

export async function createItem(workspaceId: string, input: ItemInput): Promise<Item> {
  const db = await getDb();
  const name = normalizeName(input.name);
  if (!name) throw new Error("Give the item a name.");
  const category = await db.get("categories", input.categoryId);
  if (!category || category.workspace_id !== workspaceId) {
    throw new Error("Choose a valid category.");
  }
  const existing = await listItems(workspaceId);
  const duplicate = existing.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    throw new Error(
      duplicate.is_active
        ? `“${name}” is already in your catalogue.`
        : `“${name}” exists but is inactive. Reactivate it from Items & Rates.`,
    );
  }
  const createdAt = nowISO();
  const item: Item = {
    id: newId(),
    workspace_id: workspaceId,
    category_id: input.categoryId,
    name,
    default_rate: Math.max(0, Math.round(input.defaultRate)),
    unit: input.unit.trim() || "piece",
    is_active: input.isActive ?? true,
    created_at: createdAt,
    updated_at: createdAt,
  };
  await db.put("items", item);
  return item;
}

/**
 * Changing an item's default rate only affects future picks. It writes an audit
 * row and never touches transaction_items, which keep their own price snapshots.
 */
export async function updateItem(
  workspaceId: string,
  itemId: string,
  input: ItemInput,
  changedBy: string,
): Promise<Item> {
  const db = await getDb();
  const current = await db.get("items", itemId);
  if (!current || current.workspace_id !== workspaceId) {
    throw new Error("Item not found.");
  }
  const category = await db.get("categories", input.categoryId);
  if (!category || category.workspace_id !== workspaceId) {
    throw new Error("Choose a valid category.");
  }
  const name = normalizeName(input.name);
  if (!name) throw new Error("Give the item a name.");
  const all = await listItems(workspaceId);
  if (
    all.some((item) => item.id !== itemId && item.name.toLowerCase() === name.toLowerCase())
  ) {
    throw new Error(`“${name}” is already in your catalogue.`);
  }

  const nextRate = Math.max(0, Math.round(input.defaultRate));
  const updatedAt = nowISO();
  const updated: Item = {
    ...current,
    name,
    category_id: input.categoryId,
    default_rate: nextRate,
    unit: input.unit.trim() || current.unit,
    is_active: input.isActive ?? current.is_active,
    updated_at: updatedAt,
  };

  const tx = db.transaction(["items", "item_price_history"], "readwrite");
  await tx.objectStore("items").put(updated);
  if (nextRate !== current.default_rate) {
    const history: ItemPriceHistory = {
      id: newId(),
      item_id: itemId,
      old_rate: current.default_rate,
      new_rate: nextRate,
      effective_date: todayISO(),
      changed_by: changedBy,
      created_at: updatedAt,
    };
    await tx.objectStore("item_price_history").put(history);
  }
  await tx.done;
  return updated;
}

export interface RateChange {
  itemId: string;
  /** Stored in paise. */
  newRate: number;
}

/**
 * Applies a batch of catalogue rate changes and records one audit row per item.
 * Saved expenses keep their own snapshots, so history is never rewritten.
 */
export async function applyRateChanges(
  workspaceId: string,
  changes: RateChange[],
  effectiveDate: string,
  changedBy: string,
): Promise<number> {
  if (changes.length === 0) return 0;
  if (!isValidISODate(effectiveDate)) throw new Error("Choose a valid effective date.");

  const db = await getDb();
  const items = await db.getAllFromIndex("items", "workspace", workspaceId);
  const byId = new Map(items.map((item) => [item.id, item]));
  const prepared: { item: Item; nextRate: number }[] = [];

  // One change per item; if a caller repeats an item, the last value wins.
  const latestRates = new Map(changes.map((change) => [change.itemId, change.newRate]));
  for (const [itemId, newRate] of latestRates) {
    const item = byId.get(itemId);
    if (!item) throw new Error("One of the selected items is no longer available.");
    if (!Number.isFinite(newRate) || newRate < 0 || newRate > MAX_RATE_RUPEES * 100) {
      throw new Error(`Enter a valid rate for ${item.name}.`);
    }
    const nextRate = Math.round(newRate);
    if (nextRate === item.default_rate) continue;
    prepared.push({ item, nextRate });
  }

  if (prepared.length === 0) return 0;

  const changedAt = nowISO();
  const tx = db.transaction(["items", "item_price_history"], "readwrite");
  await Promise.all(
    prepared.flatMap(({ item, nextRate }) => {
      const updated: Item = { ...item, default_rate: nextRate, updated_at: changedAt };
      const history: ItemPriceHistory = {
        id: newId(),
        item_id: item.id,
        old_rate: item.default_rate,
        new_rate: nextRate,
        effective_date: effectiveDate,
        changed_by: changedBy,
        created_at: changedAt,
      };
      return [
        tx.objectStore("items").put(updated),
        tx.objectStore("item_price_history").put(history),
      ];
    }),
  );
  await tx.done;
  return prepared.length;
}

export async function setItemActive(
  workspaceId: string,
  itemId: string,
  isActive: boolean,
): Promise<void> {
  const db = await getDb();
  const current = await db.get("items", itemId);
  if (!current || current.workspace_id !== workspaceId) throw new Error("Item not found.");
  await db.put("items", { ...current, is_active: isActive, updated_at: nowISO() });
}

export async function listPriceHistory(itemId: string): Promise<ItemPriceHistory[]> {
  const db = await getDb();
  const history = await db.getAllFromIndex("item_price_history", "item", itemId);
  return history.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function findItemByName(workspaceId: string, name: string): Promise<Item | null> {
  const items = await listItems(workspaceId);
  const normalized = name.trim().toLowerCase();
  return items.find((item) => item.name.toLowerCase() === normalized) ?? null;
}

import { DEFAULT_CATEGORY_NAMES, DEFAULT_ITEMS } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { nowISO, newId } from "@/lib/utils";
import type { Category, Item } from "@/types/domain";

export interface SeedCatalogResult {
  categories: Category[];
  items: Item[];
}

export async function seedCatalog(workspaceId: string): Promise<SeedCatalogResult> {
  const db = await getDb();
  const createdAt = nowISO();
  const categories: Category[] = DEFAULT_CATEGORY_NAMES.map((name) => ({
    id: newId(),
    workspace_id: workspaceId,
    name,
    is_active: true,
    created_at: createdAt,
  }));
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));

  const items: Item[] = DEFAULT_ITEMS.map((definition) => ({
    id: newId(),
    workspace_id: workspaceId,
    category_id: categoryIdByName.get(definition.category) ?? categories[0]?.id ?? "",
    name: definition.name,
    default_rate: Math.round(definition.rate * 100),
    unit: definition.unit,
    is_active: true,
    created_at: createdAt,
    updated_at: createdAt,
  }));

  const tx = db.transaction(["categories", "items"], "readwrite");
  await Promise.all([
    ...categories.map((category) => tx.objectStore("categories").put(category)),
    ...items.map((item) => tx.objectStore("items").put(item)),
  ]);
  await tx.done;

  return { categories, items };
}

export function inferCategoryName(itemName: string, explicit?: string | null): string {
  const provided = explicit?.trim();
  if (provided) return provided;
  const name = itemName.toLowerCase();
  if (name.includes("tea") || name.includes("chai")) return "Tea";
  if (name.includes("coffee") || name.includes("brew") || name.includes("latte")) {
    return "Coffee";
  }
  if (
    name.includes("biscuit") ||
    name.includes("toast") ||
    name.includes("donut") ||
    name.includes("cake") ||
    name.includes("snack") ||
    name.includes("cookie")
  ) {
    return "Snacks";
  }
  if (
    name.includes("meal") ||
    name.includes("rice") ||
    name.includes("thali") ||
    name.includes("sandwich") ||
    name.includes("burger") ||
    name.includes("food")
  ) {
    return "Food";
  }
  return "Other";
}

export function inferUnit(categoryName: string): string {
  const normalized = categoryName.toLowerCase();
  if (normalized === "tea" || normalized === "coffee") return "cup";
  if (normalized === "food") return "plate";
  if (normalized === "snacks") return "piece";
  return "piece";
}

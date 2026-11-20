import { ArrowUpDown, History, Package, Pencil, Plus, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { CategoryManager } from "@/features/items/category-manager";
import { ItemDialog } from "@/features/items/item-dialog";
import { PriceHistoryDialog } from "@/features/items/price-history-dialog";
import { RateUpdateDialog } from "@/features/items/rate-update-dialog";
import { useCategories, useItems, useSetItemActive } from "@/hooks/queries";
import { categoryTheme } from "@/lib/category-meta";
import { formatDateShort, toISODate } from "@/lib/dates";
import { formatRate } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Category, Item } from "@/types/domain";

interface CategoryGroup {
  category: Category | null;
  items: Item[];
}

function groupItems(categories: Category[], items: Item[]): CategoryGroup[] {
  const groups: CategoryGroup[] = categories.map((category) => ({
    category,
    items: items
      .filter((item) => item.category_id === category.id)
      .sort((left, right) => {
        if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
        return left.name.localeCompare(right.name);
      }),
  }));
  const knownCategoryIds = new Set(categories.map((category) => category.id));
  const uncategorized = items.filter((item) => !knownCategoryIds.has(item.category_id));
  if (uncategorized.length > 0) {
    groups.push({ category: null, items: uncategorized });
  }
  return groups.filter((group) => group.items.length > 0);
}

export default function ItemsPage() {
  const { workspace, currency } = useWorkspaceContext();
  const { data: items = [], isLoading } = useItems(workspace.id);
  const { data: categories = [] } = useCategories(workspace.id);
  const setItemActive = useSetItemActive(workspace.id);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);

  const activeItems = items.filter((item) => item.is_active);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      return !term || item.name.toLowerCase().includes(term);
    });
  }, [items, categoryFilter, search]);

  const groups = useMemo(() => groupItems(categories, filtered), [categories, filtered]);

  const toggleItem = async (item: Item, isActive: boolean) => {
    try {
      await setItemActive.mutateAsync({ id: item.id, isActive });
      if (isActive) {
        toast.success(`${item.name} is available again.`);
      } else {
        toast.success(`${item.name} hidden from quick entry.`, {
          description: "Past expenses are untouched.",
          action: {
            label: "Undo",
            onClick: () => {
              setItemActive.mutate(
                { id: item.id, isActive: true },
                {
                  onSuccess: () => toast.success(`${item.name} restored.`),
                  onError: () => toast.error("The item could not be restored."),
                },
              );
            },
          },
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The item could not be updated.");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
  };

  return (
    <div>
      <PageHeader
        title="Items & rates"
        description="Your café menu. Update a rate whenever prices change — saved expenses keep their original price."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRatesOpen(true)}
              className="shrink-0"
              aria-label="Update rates for several items"
            >
              <ArrowUpDown className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Update rates</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoriesOpen(true)}
              className="shrink-0"
            >
              <Tags className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Categories</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
              className="shrink-0"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add item
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search items…"
          ariaLabel="Search items"
          className="sm:max-w-sm sm:flex-1"
        />
        <p className="text-[11px] text-mocha">
          {activeItems.length} active · {items.length - activeItems.length} inactive ·{" "}
          {categories.length} categories
        </p>
      </div>

      <div className="no-scrollbar -mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "h-8 shrink-0 rounded-full border px-3 text-[11.5px] font-medium transition-colors",
            categoryFilter === "all"
              ? "border-espresso bg-espresso text-ivory"
              : "border-line bg-white text-coffee hover:border-cream-deep",
          )}
        >
          All categories
        </button>
        {categories.map((category) => {
          const theme = categoryTheme(category.name);
          const active = categoryFilter === category.id;
          const count = items.filter((item) => item.category_id === category.id).length;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryFilter(category.id)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-medium transition-colors",
                active
                  ? "border-espresso bg-espresso text-ivory"
                  : "border-line bg-white text-coffee hover:border-cream-deep",
                !category.is_active && !active && "opacity-60",
              )}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: active ? "#E9D7B9" : theme.hex }}
                aria-hidden="true"
              />
              {category.name}
              <span className={cn("text-[9.5px]", active ? "text-cream/70" : "text-mocha")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-13 w-full" />
          <Skeleton className="h-40 w-full rounded-[20px]" />
          <Skeleton className="h-40 w-full rounded-[20px]" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={items.length === 0 ? Package : History}
          title={items.length === 0 ? "Your catalogue is empty." : "No items match."}
          description={
            items.length === 0
              ? "Add your first item and its usual rate to start recording expenses faster."
              : "Try a different search or category — every item is still safely in your catalogue."
          }
          action={
            items.length === 0 ? (
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setItemDialogOpen(true);
                }}
              >
                Add your first item
              </Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const name = group.category?.name ?? "Other";
            const theme = categoryTheme(name);
            return (
              <section key={group.category?.id ?? "uncategorized"}>
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: theme.hex }}
                      aria-hidden="true"
                    />
                    <h2 className="text-[13px] font-semibold text-espresso">{name}</h2>
                    {group.category && !group.category.is_active ? (
                      <Badge variant="outline">Category inactive</Badge>
                    ) : null}
                  </div>
                  <p className="text-[10.5px] text-mocha">
                    {group.items.length} {group.items.length === 1 ? "item" : "items"}
                  </p>
                </div>
                <Card className="divide-y divide-line/70 overflow-hidden">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 px-3.5 py-3 sm:px-4">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: theme.soft, color: theme.deep }}
                        aria-hidden="true"
                      >
                        {item.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p
                            className={cn(
                              "truncate text-[13px] font-medium",
                              item.is_active ? "text-espresso" : "text-mocha",
                            )}
                          >
                            {item.name}
                          </p>
                          {!item.is_active ? <Badge variant="outline">Inactive</Badge> : null}
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-mocha">
                          <span className="amount font-medium text-coffee">
                            {formatRate(item.default_rate, currency)}
                          </span>{" "}
                          per {item.unit} · updated{" "}
                          {formatDateShort(toISODate(new Date(item.updated_at)))}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setHistoryItem(item)}
                          aria-label={`Rate history for ${item.name}`}
                          title="Rate history"
                        >
                          <History className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingItem(item);
                            setItemDialogOpen(true);
                          }}
                          aria-label={`Edit ${item.name}`}
                          title="Edit item"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={(checked) => void toggleItem(item, checked)}
                          aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.name}`}
                          className="ml-1"
                          disabled={setItemActive.isPending}
                        />
                      </div>
                    </div>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-line bg-white/60 px-4 py-3 text-[11px] leading-relaxed text-mocha">
        <History className="mt-0.5 size-3.5 shrink-0 text-caramel" aria-hidden="true" />
        Default rates currently apply only to new entries. If you change a rate, open the rate
        history to see every change we recorded.
      </div>

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        onSaved={() => setEditingItem(null)}
      />
      <PriceHistoryDialog
        item={historyItem}
        open={historyItem !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryItem(null);
        }}
      />
      <CategoryManager open={categoriesOpen} onOpenChange={setCategoriesOpen} />
      <RateUpdateDialog open={ratesOpen} onOpenChange={setRatesOpen} />
    </div>
  );
}

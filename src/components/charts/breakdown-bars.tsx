import type { CategorySummary, ItemSummary } from "@/lib/analytics";
import { categoryTheme } from "@/lib/category-meta";
import { formatMoney, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CategoryBars({
  categories,
  currency,
  className,
}: {
  categories: CategorySummary[];
  currency: string;
  className?: string;
}) {
  const max = Math.max(...categories.map((category) => category.amount), 1);
  return (
    <ul className={cn("space-y-3", className)}>
      {categories.map((category) => {
        const theme = categoryTheme(category.name);
        return (
          <li key={category.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12px]">
              <span className="flex items-center gap-2 font-medium text-espresso">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: theme.hex }}
                  aria-hidden="true"
                />
                {category.name}
              </span>
              <span className="amount text-coffee">{formatMoney(category.amount, { currency })}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-parchment">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(4, (category.amount / max) * 100)}%`,
                  backgroundColor: theme.hex,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ItemBars({
  items,
  currency,
  limit = 6,
  showQuantity = true,
}: {
  items: ItemSummary[];
  currency: string;
  limit?: number;
  showQuantity?: boolean;
}) {
  const visible = items.slice(0, limit);
  const max = Math.max(...visible.map((item) => item.amount), 1);
  return (
    <ul className="space-y-3.5">
      {visible.map((item) => {
        const theme = categoryTheme(item.categoryName);
        return (
          <li key={item.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-[13px] font-medium text-espresso">{item.name}</span>
                {showQuantity ? (
                  <span className="shrink-0 text-[10.5px] text-mocha">
                    {formatQuantity(item.quantity)} qty
                  </span>
                ) : null}
              </span>
              <span className="amount shrink-0 text-[12.5px] font-medium text-espresso">
                {formatMoney(item.amount, { currency })}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-parchment">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(3, (item.amount / max) * 100)}%`,
                  backgroundColor: theme.hex,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

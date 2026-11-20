import { Flame, Package } from "lucide-react";
import { CategoryDonut } from "@/components/charts/category-donut";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  CategorySummary,
  ComparisonItem,
  ItemSummary,
} from "@/lib/analytics";
import { categoryTheme } from "@/lib/category-meta";
import { formatMoney, formatQuantity } from "@/lib/money";

export function ItemBreakdownCard({
  items,
  currency,
  subtitle,
}: {
  items: ItemSummary[];
  currency: string;
  subtitle?: string;
}) {
  const max = Math.max(...items.map((item) => item.amount), 1);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">
            Item breakdown
          </p>
          <h2 className="mt-1 text-[15px] font-semibold text-espresso">
            {subtitle ?? "What filled the cup"}
          </h2>
        </div>
        <span className="flex size-8 items-center justify-center rounded-full bg-parchment text-coffee">
          <Package className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-mocha">No items in this period.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {items.map((item) => {
            const theme = categoryTheme(item.categoryName);
            return (
              <li key={item.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: theme.hex }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[13px] font-medium text-espresso">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-[10.5px] text-mocha">
                      {formatQuantity(item.quantity)} qty
                    </span>
                  </div>
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
                <p className="mt-1 text-[10px] text-mocha">
                  {item.categoryName} · {item.occurrences}{" "}
                  {item.occurrences === 1 ? "line" : "lines"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function CategoryCard({
  categories,
  total,
  currency,
}: {
  categories: CategorySummary[];
  total: number;
  currency: string;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">
          Category split
        </p>
        <h2 className="mt-1 text-[15px] font-semibold text-espresso">Where it went</h2>
      </div>
      {categories.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-mocha">No categories in this period.</p>
      ) : (
        <div className="mt-4">
          <CategoryDonut categories={categories} currency={currency} total={total} />
        </div>
      )}
    </Card>
  );
}

export function HighestItemCard({
  item,
  currency,
}: {
  item: ItemSummary | null;
  currency: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4 sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F8E4DC] text-terracotta">
        <Flame className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-mocha">
          Highest expenditure item
        </p>
        <p className="mt-0.5 truncate text-[13px] font-medium text-espresso">
          {item?.name ?? "Nothing yet"}
        </p>
        {item ? (
          <p className="text-[10.5px] text-mocha">
            {item.categoryName} · {formatQuantity(item.quantity)} qty
          </p>
        ) : null}
      </div>
      <p className="amount shrink-0 text-[15px] font-semibold text-espresso">
        {formatMoney(item?.amount ?? 0, { currency })}
      </p>
    </Card>
  );
}

export function ConsumptionComparison({
  items,
  currency,
  currentLabel,
  previousLabel,
}: {
  items: ComparisonItem[];
  currency: string;
  currentLabel: string;
  previousLabel: string;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">
          Consumption comparison
        </p>
        <h2 className="mt-1 text-[15px] font-semibold text-espresso">
          {currentLabel} vs {previousLabel}
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-mocha">No items recorded in either month.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line/70">
          {items.map((item) => {
            const change = item.currentQuantity - item.previousQuantity;
            const theme = categoryTheme(item.categoryName);
            return (
              <li key={item.key} className="flex items-center gap-3 py-3">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: theme.hex }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-espresso">{item.name}</p>
                  <p className="mt-0.5 text-[10.5px] text-mocha">
                    {formatMoney(item.currentAmount, { currency })} vs{" "}
                    {formatMoney(item.previousAmount, { currency })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="amount text-[11.5px] text-coffee">
                    {formatQuantity(item.currentQuantity)} vs{" "}
                    {formatQuantity(item.previousQuantity)}
                  </p>
                  <Badge
                    variant={change > 0 ? "terracotta" : change < 0 ? "sage" : "outline"}
                    className="mt-1"
                  >
                    {change > 0 ? `+${change}` : change === 0 ? "Same" : change} qty
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

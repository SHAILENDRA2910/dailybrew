import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategorySummary } from "@/lib/analytics";
import { categoryTheme } from "@/lib/category-meta";
import { formatMoney } from "@/lib/money";

interface CategoryDonutProps {
  categories: CategorySummary[];
  currency: string;
  total: number;
}

const tooltipStyle = {
  background: "#38251D",
  border: "none",
  borderRadius: 12,
  padding: "8px 12px",
  color: "#FAF6EF",
  fontSize: 12,
} as const;

export function CategoryDonut({ categories, currency, total }: CategoryDonutProps) {
  const data = categories.map((category) => ({
    name: category.name,
    value: category.amount,
    color: categoryTheme(category.name).hex,
  }));

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 shrink-0" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="63%"
              outerRadius="90%"
              paddingAngle={2.5}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [formatMoney(Number(value), { currency }), "Spent"]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.12em] text-mocha">Total</span>
          <span className="amount text-sm font-semibold text-espresso">
            {formatMoney(total, { currency, decimals: 0 })}
          </span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {categories.slice(0, 5).map((category) => {
          const theme = categoryTheme(category.name);
          return (
            <li key={category.name} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="flex min-w-0 items-center gap-2 text-coffee">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: theme.hex }}
                  aria-hidden="true"
                />
                <span className="truncate">{category.name}</span>
                <span className="text-[10px] text-mocha">{category.percentage}%</span>
              </span>
              <span className="amount shrink-0 font-medium text-espresso">
                {formatMoney(category.amount, { currency })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

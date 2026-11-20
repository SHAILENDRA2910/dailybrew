import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/money";

export interface ComparisonDatum {
  name: string;
  current: number;
  previous: number;
}

const tooltipStyle = {
  background: "#38251D",
  border: "none",
  borderRadius: 12,
  padding: "8px 12px",
  color: "#FAF6EF",
  fontSize: 12,
} as const;

export function ComparisonChart({
  data,
  currency,
  currentLabel,
  previousLabel,
}: {
  data: ComparisonDatum[];
  currency: string;
  currentLabel: string;
  previousLabel: string;
}) {
  return (
    <div aria-hidden="true">
      <div className="mb-4 flex items-center gap-4 text-[11px] text-mocha">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-caramel" /> {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#D8C4A5]" /> {previousLabel}
        </span>
      </div>
      <div style={{ height: Math.max(190, data.length * 42) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            barGap={2}
          >
            <CartesianGrid horizontal={false} stroke="#EAE1D5" strokeDasharray="3 5" />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={82}
              tick={{ fill: "#70452F", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(233,215,185,0.28)" }}
              contentStyle={tooltipStyle}
              formatter={(value) => formatMoney(Number(value), { currency })}
            />
            <Bar dataKey="previous" fill="#D8C4A5" radius={[0, 5, 5, 0]} maxBarSize={9} isAnimationActive={false} />
            <Bar dataKey="current" fill="#C58B52" radius={[0, 5, 5, 0]} maxBarSize={9} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { dayOfMonth, formatDateShort, formatDateWithWeekday } from "@/lib/dates";

interface ChartProps {
  points: DailyPoint[];
  currency: string;
  height?: number;
  compact?: boolean;
}

const tooltipStyle = {
  background: "#38251D",
  border: "none",
  borderRadius: 12,
  padding: "8px 12px",
  boxShadow: "0 14px 30px -16px rgba(56,37,29,.5)",
  color: "#FAF6EF",
  fontSize: 12,
} as const;

const tooltipLabelStyle = {
  color: "#E9D7B9",
  fontSize: 10,
  marginBottom: 2,
} as const;

export function SpendingTrend({ points, currency, height = 170, compact = false }: ChartProps) {
  const gradientId = `trend-${useId().replace(/:/g, "")}`;
  return (
    <div style={{ height }} className="w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C58B52" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#C58B52" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#EAE1D5" strokeDasharray="3 5" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#88796D", fontSize: compact ? 9.5 : 10.5 }}
            tickFormatter={(value: string) => formatDateShort(value)}
            interval="preserveStartEnd"
            minTickGap={compact ? 28 : 34}
            dy={6}
          />
          <Tooltip
            cursor={{ stroke: "#C58B52", strokeWidth: 1, strokeDasharray: "3 4" }}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            labelFormatter={(label) => formatDateWithWeekday(String(label))}
            formatter={(value) => [formatMoney(Number(value), { currency }), "Spent"]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#70452F"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3.5, fill: "#C58B52", stroke: "#FAF6EF", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpendingBars({ points, currency, height = 168 }: ChartProps) {
  return (
    <div style={{ height }} className="w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 2, left: 0, bottom: 0 }} barCategoryGap="26%">
          <CartesianGrid vertical={false} stroke="#EAE1D5" strokeDasharray="3 5" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#88796D", fontSize: 10 }}
            tickFormatter={(value: string) => dayOfMonth(value)}
            dy={6}
          />
          <Tooltip
            cursor={{ fill: "rgba(233,215,185,0.35)", radius: 6 }}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            labelFormatter={(label) => formatDateWithWeekday(String(label))}
            formatter={(value) => [formatMoney(Number(value), { currency }), "Spent"]}
          />
          <Bar
            dataKey="amount"
            fill="#C58B52"
            radius={[6, 6, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

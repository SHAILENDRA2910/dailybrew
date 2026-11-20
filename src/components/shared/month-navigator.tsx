import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonthKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface MonthNavigatorProps {
  value: string;
  onChange: (month: string) => void;
  className?: string;
  disabledNext?: boolean;
}

export function MonthNavigator({
  value,
  onChange,
  className,
  disabledNext = false,
}: MonthNavigatorProps) {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center justify-between gap-1 rounded-full border border-line bg-white px-1 shadow-card",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(shiftMonthKey(value, -1))}
        className="flex size-9 items-center justify-center rounded-full text-mocha transition-colors hover:bg-parchment hover:text-espresso"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[8.5rem] px-2 text-center text-[13px] font-medium text-espresso">
        {monthLabel(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonthKey(value, 1))}
        disabled={disabledNext}
        className="flex size-9 items-center justify-center rounded-full text-mocha transition-colors hover:bg-parchment hover:text-espresso disabled:pointer-events-none disabled:opacity-30"
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

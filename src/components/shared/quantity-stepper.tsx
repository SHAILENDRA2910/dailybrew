import { Minus, Plus } from "lucide-react";
import { MAX_QUANTITY } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  itemName: string;
  className?: string;
  compact?: boolean;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = MAX_QUANTITY,
  itemName,
  className,
  compact = false,
}: QuantityStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const buttonSize = compact ? "size-9" : "size-10";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-white",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className={cn(
          "flex items-center justify-center rounded-full text-coffee transition-colors hover:bg-parchment disabled:opacity-30",
          buttonSize,
        )}
        aria-label={`Decrease ${itemName} quantity`}
      >
        <Minus className="size-3.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
          if (!digits) {
            onChange(min);
            return;
          }
          onChange(clamp(Number(digits)));
        }}
        onFocus={(event) => event.currentTarget.select()}
        className="amount h-9 w-9 border-0 bg-transparent p-0 text-center text-sm font-semibold text-espresso focus:outline-none focus-visible:ring-2 focus-visible:ring-caramel"
        aria-label={`${itemName} quantity`}
        maxLength={3}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className={cn(
          "flex items-center justify-center rounded-full text-coffee transition-colors hover:bg-parchment disabled:opacity-30",
          buttonSize,
        )}
        aria-label={`Increase ${itemName} quantity`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

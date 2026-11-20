import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  tone?: "default" | "cream";
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  className,
  tone = "default",
}: StatTileProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-4 sm:p-5",
        tone === "cream" && "border-cream-deep/50 bg-cream/35",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-mocha">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              tone === "cream" ? "bg-white/70 text-coffee" : "bg-parchment text-coffee",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="amount mt-3 text-[26px] font-semibold leading-none text-espresso sm:text-[28px]">
        {value}
      </p>
      {hint ? <div className="mt-2.5 text-[11.5px] leading-snug text-mocha">{hint}</div> : null}
    </Card>
  );
}

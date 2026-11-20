import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[20px] border border-dashed border-cream-deep/70 bg-white/60 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-cream/50 text-coffee">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      {eyebrow ? (
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-caramel">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="text-base font-semibold text-espresso">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-mocha">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("soft-pulse rounded-xl bg-parchment/90", className)} aria-hidden="true" />;
}

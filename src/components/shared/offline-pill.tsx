import { CloudOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";

export function OfflinePill({ className }: { className?: string }) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-cream-deep/70 bg-cream/40 px-2.5 py-1 text-[11px] font-medium text-coffee",
        className,
      )}
      title="DailyBrew works offline. Changes are saved on this device."
    >
      <CloudOff className="size-3" aria-hidden="true" />
      Offline · saved here
    </span>
  );
}

export function StorageStatus({ className }: { className?: string }) {
  const online = useOnlineStatus();
  return (
    <p className={cn("flex items-center gap-1.5 text-[11px] text-mocha", className)}>
      <span
        className={cn("size-1.5 rounded-full", online ? "bg-sage" : "bg-caramel")}
        aria-hidden="true"
      />
      {online ? "On this device" : "Offline · still saving locally"}
    </p>
  );
}

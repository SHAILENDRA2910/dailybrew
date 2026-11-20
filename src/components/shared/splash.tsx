import { CupMark } from "@/components/shared/brand";

export function Splash({ label = "Brewing your day" }: { label?: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ivory"
      role="status"
      aria-live="polite"
      aria-label="Loading DailyBrew"
    >
      <div className="soft-pulse">
        <CupMark className="size-16 rounded-[22px]" />
      </div>
      <div className="text-center">
        <p className="text-[17px] font-semibold tracking-[-0.04em] text-espresso">
          DailyBrew<span className="text-caramel">.</span>
        </p>
        <p className="mt-1 text-xs text-mocha">{label}</p>
      </div>
    </div>
  );
}

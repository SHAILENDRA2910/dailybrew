import { Link } from "react-router-dom";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Brand } from "@/components/shared/brand";
import { OfflinePill } from "@/components/shared/offline-pill";
import { initials } from "@/lib/utils";

export function MobileHeader() {
  const { profile } = useWorkspaceContext();
  const displayName = profile?.full_name || "DailyBrew";
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ivory/92 pt-safe backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex h-14 w-full items-center justify-between gap-3 px-4">
        <Link to="/" aria-label="DailyBrew home">
          <Brand markClassName="size-8" wordmarkClassName="text-[16px]" />
        </Link>
        <div className="flex items-center gap-2">
          <OfflinePill className="hidden min-[380px]:inline-flex" />
          <Link
            to="/settings"
            aria-label="Open settings"
            className="flex size-9 items-center justify-center rounded-full border border-line bg-white text-[11px] font-semibold text-espresso shadow-sm transition-colors hover:border-cream-deep"
          >
            {initials(displayName)}
          </Link>
        </div>
      </div>
    </header>
  );
}

import {
  ArrowLeftRight,
  ChevronRight,
  Package,
  Settings,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspaceContext } from "@/app/workspace-context";
import { CoffeeRing } from "@/components/shared/brand";
import { PageHeader } from "@/components/shared/page-header";
import { StorageStatus } from "@/components/shared/offline-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBudgets, useExpenses, useItems } from "@/hooks/queries";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { APP_VERSION } from "@/lib/constants";
import { currentMonthKey, monthLabel, parseMonthKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { initials } from "@/lib/utils";

export default function MorePage() {
  const { workspace, profile, currency } = useWorkspaceContext();
  const { data: items = [] } = useItems(workspace.id);
  const { data: budgets = [] } = useBudgets(workspace.id);
  const { data: expenses = [] } = useExpenses(workspace.id);
  const { canPrompt, isStandalone, promptInstall } = useInstallPrompt();

  const activeItems = items.filter((item) => item.is_active).length;
  const { year, month } = parseMonthKey(currentMonthKey());
  const budget = budgets.find((entry) => entry.year === year && entry.month === month);

  const rows = [
    {
      to: "/items",
      label: "Items & rates",
      description: `${activeItems} active ${activeItems === 1 ? "item" : "items"} · update prices safely`,
      icon: Package,
      tint: "#EDF1E8",
      color: "#5C6851",
    },
    {
      to: "/budgets",
      label: "Budgets",
      description: budget
        ? `${monthLabel(currentMonthKey())} · ${formatMoney(budget.budget_amount, { currency })}`
        : "Optional monthly ceilings",
      icon: Wallet,
      tint: "#F7EAD9",
      color: "#8B5C31",
    },
    {
      to: "/data",
      label: "Import & export",
      description: "Excel import · CSV, Excel & printable PDF",
      icon: ArrowLeftRight,
      tint: "#F2E6DC",
      color: "#70452F",
    },
    {
      to: "/settings",
      label: "Settings",
      description: "Profile, install guide and local data",
      icon: Settings,
      tint: "#F1EBE3",
      color: "#6B5E53",
    },
  ];

  return (
    <div>
      <PageHeader
        title="More"
        description="The back counter — everything behind the daily ledger."
      />

      <Card className="relative overflow-hidden border-none bg-espresso p-5 text-ivory shadow-lift">
        <CoffeeRing className="pointer-events-none absolute -right-14 -top-20 size-56 opacity-80" />
        <div className="relative flex items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cream text-[14px] font-semibold text-espresso">
            {initials(profile?.full_name || "DailyBrew Owner")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9.5px] font-medium uppercase tracking-[0.15em] text-cream/60">
              Workspace
            </p>
            <h2 className="mt-0.5 truncate text-[17px] font-semibold text-ivory">
              {workspace.name}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-cream/65">
              {profile?.full_name || "Owner"} · Local owner
            </p>
          </div>
          <Link
            to="/settings"
            aria-label="Open settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-ivory/15 bg-ivory/10 text-cream transition-colors hover:bg-ivory/15"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-ivory/10 pt-3 text-[10.5px] text-cream/60">
          <span>{expenses.length} saved entries</span>
          <span className="size-1 rounded-full bg-cream/30" aria-hidden="true" />
          <span>{activeItems} active items</span>
          <div className="ml-auto">
            <StorageStatus className="text-[10.5px] text-cream/60" />
          </div>
        </div>
      </Card>

      <Card className="mt-4 divide-y divide-line/70 overflow-hidden">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <Link
              key={row.to}
              to={row.to}
              className="flex min-h-[68px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[#FDF9F2] sm:px-5"
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: row.tint, color: row.color }}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-espresso">{row.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-mocha">
                  {row.description}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-mocha" aria-hidden="true" />
            </Link>
          );
        })}
      </Card>

      {!isStandalone ? (
        <Card className="mt-4 flex flex-col gap-3 border-cream-deep/50 bg-[#FBF6EE] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-coffee">
              <Smartphone className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-medium text-espresso">Keep DailyBrew on your home screen</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-mocha">
                Install it for an app-like launch and offline access.
              </p>
            </div>
          </div>
          {canPrompt ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 bg-white"
              onClick={() => void promptInstall()}
            >
              Install app
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="shrink-0 bg-white">
              <Link to="/settings">How to install</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="mt-4 flex items-center justify-center">
          <Badge variant="sage">Installed on this device</Badge>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-1.5 pb-2 text-center">
        <p className="text-[11.5px] font-semibold tracking-[-0.02em] text-espresso">
          DailyBrew<span className="text-caramel">.</span>
        </p>
        <p className="text-[10px] text-mocha">Version {APP_VERSION} · Made for the daily ritual</p>
      </div>
    </div>
  );
}

import { Plus } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Brand } from "@/components/shared/brand";
import { StorageStatus } from "@/components/shared/offline-pill";
import { sidebarSections } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { useWorkspaceContext } from "@/app/workspace-context";
import { cn, initials } from "@/lib/utils";

export function Sidebar() {
  const { workspace, profile } = useWorkspaceContext();
  const displayName = profile?.full_name || "DailyBrew owner";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line/80 bg-[#FCF8F1] px-4 py-6 lg:flex">
      <Link to="/" className="px-2" aria-label="DailyBrew home">
        <Brand />
      </Link>

      <Button asChild className="mt-7 w-full justify-start gap-2.5 px-4">
        <Link to="/add">
          <span className="flex size-5 items-center justify-center rounded-full bg-ivory/15">
            <Plus className="size-3.5" aria-hidden="true" />
          </span>
          Add expense
        </Link>
      </Button>

      <nav className="no-scrollbar mt-7 flex-1 overflow-y-auto" aria-label="Desktop navigation">
        {sidebarSections.map((section) => (
          <div key={section.label} className="mb-6 last:mb-0">
            <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-mocha/80">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13.5px] transition-colors",
                          isActive
                            ? "bg-white font-medium text-espresso shadow-[0_1px_3px_rgba(56,37,29,0.08)]"
                            : "text-coffee hover:bg-parchment/70",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn("size-[17px]", isActive ? "text-espresso" : "text-mocha")}
                            strokeWidth={isActive ? 2.1 : 1.8}
                            aria-hidden="true"
                          />
                          <span>{item.label}</span>
                          {isActive ? (
                            <span className="ml-auto size-1.5 rounded-full bg-caramel" aria-hidden="true" />
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-line/80 pt-4">
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-parchment/70"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cream/70 text-[12px] font-semibold text-espresso">
            {initials(displayName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium text-espresso">
              {workspace.name}
            </span>
            <span className="block truncate text-[11px] text-mocha">{displayName}</span>
          </span>
        </Link>
        <StorageStatus className="mt-2.5 px-2" />
      </div>
    </aside>
  );
}

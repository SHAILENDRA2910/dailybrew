import { Home, Plus, MoreHorizontal, ReceiptText, ChartPie } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/expenses", label: "Expenses", icon: ReceiptText, end: false },
  { to: "/add", label: "Add", icon: Plus, end: false, primary: true },
  { to: "/reports", label: "Reports", icon: ChartPie, end: false },
  { to: "/more", label: "More", icon: MoreHorizontal, end: false },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-white/95 pb-safe backdrop-blur-xl lg:hidden"
    >
      <div className="grid h-[68px] grid-cols-5 items-center px-2">
        {items.map((item) => {
          const Icon = item.icon;
          if (item.primary) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label="Add expense"
                className="group flex flex-col items-center justify-center gap-0.5 focus-visible:outline-none"
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center rounded-full bg-espresso text-ivory shadow-[0_10px_22px_-10px_rgba(56,37,29,0.75)] transition-transform duration-200 group-active:scale-95",
                        isActive && "ring-4 ring-cream/70",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        isActive ? "text-espresso" : "text-mocha",
                      )}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl transition-colors",
                  isActive ? "text-espresso" : "text-mocha hover:text-coffee",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="size-[21px]"
                    strokeWidth={isActive ? 2.2 : 1.8}
                    aria-hidden="true"
                  />
                  <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

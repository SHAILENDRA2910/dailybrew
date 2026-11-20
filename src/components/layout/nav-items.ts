import {
  ArrowLeftRight,
  ChartPie,
  Home,
  Package,
  ReceiptText,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  description?: string;
}

export const sidebarSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Track",
    items: [
      { to: "/", label: "Home", icon: Home, end: true, description: "Today at a glance" },
      { to: "/expenses", label: "Expenses", icon: ReceiptText, description: "Every entry" },
      { to: "/reports", label: "Reports", icon: ChartPie, description: "Patterns & trends" },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/items", label: "Items & Rates", icon: Package, description: "Catalogue" },
      { to: "/budgets", label: "Budgets", icon: Wallet, description: "Monthly limits" },
      { to: "/data", label: "Import & Export", icon: ArrowLeftRight, description: "Your workbook" },
      { to: "/settings", label: "Settings", icon: Settings, description: "Workspace" },
    ],
  },
];

export const APP_NAME = "DailyBrew";
export const APP_VERSION = "1.0.0";

export const SAMPLE_WORKBOOK_FILE = "Monthly Eatery Expense Tracker - 2026.xlsx";
export const SAMPLE_WORKBOOK_PATH = `/${SAMPLE_WORKBOOK_FILE}`;

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "USD", label: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", label: "Euro", symbol: "€", locale: "en-IE" },
  { code: "GBP", label: "British Pound", symbol: "£", locale: "en-GB" },
  { code: "AED", label: "UAE Dirham", symbol: "AED", locale: "en-AE" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const UNITS = [
  { value: "cup", label: "Cup" },
  { value: "glass", label: "Glass" },
  { value: "piece", label: "Piece" },
  { value: "plate", label: "Plate" },
  { value: "serving", label: "Serving" },
  { value: "packet", label: "Packet" },
  { value: "kg", label: "Kilogram" },
  { value: "litre", label: "Litre" },
] as const;

export const DEFAULT_CATEGORY_NAMES = ["Tea", "Coffee", "Snacks", "Food", "Other"] as const;

export interface DefaultItemDefinition {
  name: string;
  category: (typeof DEFAULT_CATEGORY_NAMES)[number];
  /** Rupees; converted to paise at seed/import time. */
  rate: number;
  unit: string;
}

export const DEFAULT_ITEMS: DefaultItemDefinition[] = [
  { name: "Black Coffee", category: "Coffee", rate: 20, unit: "cup" },
  { name: "Milk Coffee", category: "Coffee", rate: 25, unit: "cup" },
  { name: "Coffee", category: "Coffee", rate: 20, unit: "cup" },
  { name: "Tea Medium", category: "Tea", rate: 18, unit: "cup" },
  { name: "Tea Small", category: "Tea", rate: 15, unit: "cup" },
  { name: "Lemon Tea", category: "Tea", rate: 20, unit: "cup" },
  { name: "Biscuit", category: "Snacks", rate: 5, unit: "piece" },
  { name: "Toast", category: "Snacks", rate: 5, unit: "piece" },
  { name: "Donut", category: "Snacks", rate: 15, unit: "piece" },
];

export const MAX_QUANTITY = 999;
export const MAX_RATE_RUPEES = 100_000;
export const MAX_BUDGET_RUPEES = 100_000_000;

export const IMPORT_HEADER_ALIASES = {
  date: ["date", "expense date", "expense_date", "txn date", "transaction date", "day"],
  item: ["item", "item name", "name", "description", "particulars"],
  quantity: ["quantity", "qty", "units", "count"],
  rate: ["rate", "rate (inr)", "unit rate", "price", "unit price"],
  total: ["total", "total amount", "total amount (inr)", "amount", "line total"],
  month: ["month", "period"],
  category: ["category", "type"],
} as const;

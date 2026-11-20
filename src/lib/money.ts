import { CURRENCIES, type CurrencyCode } from "@/lib/constants";

export const DEFAULT_CURRENCY: CurrencyCode = "INR";

export function currencySymbol(currency?: string): string {
  return CURRENCIES.find((entry) => entry.code === currency)?.symbol ?? "₹";
}

export interface MoneyFormatOptions {
  decimals?: number;
  compact?: boolean;
  currency?: string;
}

function resolveCurrency(currency?: string): { code: string; locale: string } {
  const match = CURRENCIES.find((entry) => entry.code === currency);
  if (match) return { code: match.code, locale: match.locale };
  return { code: DEFAULT_CURRENCY, locale: "en-IN" };
}

/** Amounts are always integer paise; formatting never does float arithmetic. */
export function formatMoney(paise: number, options: MoneyFormatOptions = {}): string {
  const { code, locale } = resolveCurrency(options.currency);
  const decimals = options.decimals ?? 2;
  const value = (Number.isFinite(paise) ? paise : 0) / 100;
  try {
    return new Intl.NumberFormat(options.compact ? "en-IN" : locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      notation: options.compact ? "compact" : "standard",
      minimumFractionDigits: options.compact ? 0 : decimals,
      maximumFractionDigits: options.compact ? 1 : decimals,
    }).format(value);
  } catch {
    return `₹${value.toFixed(decimals)}`;
  }
}

/** Rates hide unnecessary decimals: ₹18 rather than ₹18.00. */
export function formatRate(paise: number, currency?: string): string {
  const decimals = paise % 100 === 0 ? 0 : 2;
  return formatMoney(paise, { decimals, currency });
}

export function formatMoneyInput(paise: number): string {
  if (!Number.isFinite(paise)) return "";
  const value = paise / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function toPaise(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Accepts "1,240.50", "₹ 18", "18.5" and numeric values.
 * Returns null for blank or unparseable input so forms can show a clear error.
 */
export function parseAmountToPaise(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  const cleaned = input
    .replace(/[₹$€£,]|AED|INR|USD|EUR|GBP/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function sumAmounts(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + Math.round(amount), 0);
}

export function lineTotal(quantity: number, unitRate: number): number {
  return Math.round(quantity * unitRate);
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity);
  return Number(quantity.toFixed(2)).toString();
}

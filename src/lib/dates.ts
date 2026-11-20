import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameYear,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

export type DateFormatPreference = "dmy" | "medium";

/**
 * Display-only preference, set once from the saved workspace before the shell
 * renders. Amounts and stored dates never change with it.
 */
let activeDateFormat: DateFormatPreference = "dmy";

export function setDateFormatPreference(
  value: DateFormatPreference | string | null | undefined,
): void {
  activeDateFormat = value === "medium" ? "medium" : "dmy";
}

export function getDateFormatPreference(): DateFormatPreference {
  return activeDateFormat;
}

const medium = () => activeDateFormat === "medium";

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parses a calendar date at noon local time to avoid DST boundary shifts. */
export function parseDateOnly(value: string): Date {
  if (!ISO_DATE.test(value)) {
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : new Date(NaN);
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = parseDateOnly(value);
  return isValid(parsed) && toISODate(parsed) === value;
}

export function formatDateLong(value: string): string {
  const date = parseDateOnly(value);
  if (!isValid(date)) return value;
  return format(date, medium() ? "EEEE, d MMMM yyyy" : "EEEE, dd/MM/yyyy");
}

export function formatDateMedium(value: string): string {
  const date = parseDateOnly(value);
  if (!isValid(date)) return value;
  return format(date, medium() ? "d MMM yyyy" : "dd/MM/yyyy");
}

export function formatDateShort(value: string): string {
  const date = parseDateOnly(value);
  if (!isValid(date)) return value;
  return format(date, medium() ? "d MMM" : "dd/MM");
}

export function formatDateWithWeekday(value: string): string {
  const date = parseDateOnly(value);
  if (!isValid(date)) return value;
  return format(date, medium() ? "EEE, d MMM" : "EEE, dd/MM");
}

export function relativeDayLabel(value: string): string {
  const date = parseDateOnly(value);
  if (!isValid(date)) return value;
  const today = new Date();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, subDays(today, 1))) return "Yesterday";
  return formatDateWithWeekday(value);
}

export function dateGroupLabel(value: string): string {
  const date = parseDateOnly(value);
  if (!isValid(date)) return value;
  const today = new Date();
  const prefix = isSameDay(date, today)
    ? "Today"
    : isSameDay(date, subDays(today, 1))
      ? "Yesterday"
      : format(date, "EEEE");
  const sameYear = isSameYear(date, today);
  const pattern = medium()
    ? sameYear
      ? "d MMMM"
      : "d MMMM yyyy"
    : sameYear
      ? "dd/MM"
      : "dd/MM/yyyy";
  return `${prefix} · ${format(date, pattern)}`;
}

export function monthKeyFromDate(date: Date): string {
  return format(date, "yyyy-MM");
}

export function monthKeyFromISO(value: string): string {
  return value.slice(0, 7);
}

export function currentMonthKey(): string {
  return monthKeyFromDate(new Date());
}

export function isValidMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

export function parseMonthKey(value: string): { year: number; month: number } {
  const [year, month] = value.split("-").map(Number);
  return { year: year ?? new Date().getFullYear(), month: month ?? 1 };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthLabel(value: string): string {
  if (!isValidMonthKey(value)) return value;
  const { year, month } = parseMonthKey(value);
  return format(new Date(year, month - 1, 1, 12), "MMMM yyyy");
}

export function monthLabelShort(value: string): string {
  if (!isValidMonthKey(value)) return value;
  const { year, month } = parseMonthKey(value);
  return format(new Date(year, month - 1, 1, 12), "MMM yyyy");
}

export function monthRange(value: string): { from: string; to: string } {
  const { year, month } = parseMonthKey(value);
  const start = startOfMonth(new Date(year, month - 1, 1, 12));
  const end = endOfMonth(start);
  return { from: toISODate(start), to: toISODate(end) };
}

export function currentMonthRange(): { from: string; to: string } {
  return monthRange(currentMonthKey());
}

export function weekRange(anchorISO: string): { from: string; to: string } {
  const anchor = parseDateOnly(anchorISO);
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = endOfWeek(anchor, { weekStartsOn: 1 });
  return { from: toISODate(start), to: toISODate(end) };
}

export function shiftMonthKey(value: string, amount: number): string {
  const { year, month } = parseMonthKey(value);
  return monthKeyFromDate(addMonths(new Date(year, month - 1, 1, 12), amount));
}

export function shiftISODate(value: string, amount: number): string {
  return toISODate(addDays(parseDateOnly(value), amount));
}

export function shiftISOMonths(value: string, amount: number): string {
  return toISODate(addMonths(parseDateOnly(value), amount));
}

export function eachDate(from: string, to: string): string[] {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!isValid(start) || !isValid(end) || start > end) return [];
  return eachDayOfInterval({ start, end }).map(toISODate);
}

export function daysBetween(from: string, to: string): number {
  return eachDate(from, to).length;
}

export function isWithinRange(value: string, from: string, to: string): boolean {
  return value >= from && value <= to;
}

export function previousMonthKey(value: string): string {
  return shiftMonthKey(value, -1);
}

export function lastNDates(count: number, endISO = todayISO()): string[] {
  const end = parseDateOnly(endISO);
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    return toISODate(subDays(end, offset));
  });
}

export function formatRangeLabel(from: string, to: string): string {
  if (from === to) return formatDateMedium(from);
  return `${formatDateShort(from)} – ${formatDateMedium(to)}`;
}

export function weekdayShort(value: string): string {
  return format(parseDateOnly(value), "EEE");
}

export function dayOfMonth(value: string): string {
  return format(parseDateOnly(value), "d");
}

export function isCurrentMonth(value: string): boolean {
  return value === currentMonthKey();
}

export function monthOptionsFrom(months: string[], extraCount = 12): string[] {
  const set = new Set(months);
  const base = new Date();
  for (let index = 0; index < extraCount; index += 1) {
    set.add(monthKeyFromDate(subMonths(base, index)));
  }
  set.add(currentMonthKey());
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (!isValid(parsed)) return value;
  return format(parsed, medium() ? "d MMM yyyy, h:mm a" : "dd/MM/yyyy, h:mm a");
}

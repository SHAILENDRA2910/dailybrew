import { format, isValid, parse } from "date-fns";
import * as XLSX from "xlsx";
import { IMPORT_HEADER_ALIASES, SAMPLE_WORKBOOK_FILE, SAMPLE_WORKBOOK_PATH } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { inferCategoryName } from "@/lib/seed";
import { isValidISODate } from "@/lib/dates";
import { newId } from "@/lib/utils";
import type {
  ImportPreview,
  ImportPreviewRow,
  ImportRowStatus,
} from "@/types/domain";

type RawRow = unknown[];

interface ColumnMap {
  date: number;
  item: number;
  quantity: number;
  rate: number;
  total: number;
  month: number;
  category: number;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .replace(/[:\u00a0]/g, "")
    .trim()
    .toLowerCase();
}

function matchColumn(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function buildColumnMap(headers: string[]): ColumnMap {
  return {
    date: matchColumn(headers, IMPORT_HEADER_ALIASES.date),
    item: matchColumn(headers, IMPORT_HEADER_ALIASES.item),
    quantity: matchColumn(headers, IMPORT_HEADER_ALIASES.quantity),
    rate: matchColumn(headers, IMPORT_HEADER_ALIASES.rate),
    total: matchColumn(headers, IMPORT_HEADER_ALIASES.total),
    month: matchColumn(headers, IMPORT_HEADER_ALIASES.month),
    category: matchColumn(headers, IMPORT_HEADER_ALIASES.category),
  };
}

function headerMatchScore(map: ColumnMap): number {
  return [
    map.date,
    map.item,
    map.quantity,
    map.rate,
    map.total,
    map.month,
    map.category,
  ].filter((index) => index >= 0).length;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function rowIsBlank(row: RawRow): boolean {
  return row.every(isBlank);
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return isValid(value) ? format(value, "yyyy-MM-dd") : "";
  return String(value).replace(/\s+/g, " ").trim();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[₹$€£,]|INR|USD|EUR|GBP|AED/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

const STRING_DATE_FORMATS = [
  "d/M/yyyy",
  "d-M-yyyy",
  "d.M.yyyy",
  "yyyy/M/d",
  "d MMM yyyy",
  "d MMMM yyyy",
  "MMM d, yyyy",
  "MMMM d, yyyy",
];

/**
 * Normalises Excel serials, dd/mm/yyyy strings, ISO timestamps and named months
 * into a local YYYY-MM-DD calendar date. Invalid calendar dates are rejected.
 */
export function normalizeImportDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    if (!isValid(value)) return null;
    const candidate = format(value, "yyyy-MM-dd");
    return isValidISODate(candidate) ? candidate : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1) return null;
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed || !parsed.y || !parsed.m || !parsed.d) return null;
    const candidate = `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    return isValidISODate(candidate) ? candidate : null;
  }

  const text = String(value).trim();
  if (!text) return null;

  const isoPrefix = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoPrefix) {
    const candidate = `${isoPrefix[1]}-${String(isoPrefix[2]).padStart(2, "0")}-${String(isoPrefix[3]).padStart(2, "0")}`;
    return isValidISODate(candidate) ? candidate : null;
  }

  const dayFirst = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    let year = Number(dayFirst[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day, 12);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return format(date, "yyyy-MM-dd");
  }

  for (const pattern of STRING_DATE_FORMATS) {
    const parsed = parse(text, pattern, new Date(2020, 0, 1, 12));
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
  }

  return null;
}

function rawDateDisplay(value: unknown): string {
  if (value instanceof Date) return isValid(value) ? format(value, "dd/MM/yyyy") : "";
  if (typeof value === "number") {
    try {
      return XLSX.SSF.format("dd/mm/yyyy", value);
    } catch {
      return String(value);
    }
  }
  return cellText(value);
}

function isSummaryRow(row: RawRow, map: ColumnMap): boolean {
  const cells = [row[map.date], row[map.item], row[0], row[1]]
    .map((cell) => cellText(cell).toLowerCase())
    .filter(Boolean);
  return cells.some((cell) =>
    /^(grand\s+)?totals?|^summary$|^sub\s*total$/.test(cell.replace(/\s+/g, " ")),
  );
}

function fingerprintFor(
  date: string,
  itemName: string,
  quantity: number,
  ratePaise: number,
  occurrence: number,
): string {
  return `${date}|${itemName.trim().toLowerCase()}|${quantity}|${ratePaise}|${occurrence}`;
}

export function parseWorkbookRows(
  rawRows: RawRow[],
  fileName: string,
  sheetName: string,
  existingFingerprints: Set<string>,
): ImportPreview {
  let headerRowIndex = -1;
  let headers: string[] = [];
  let map: ColumnMap = {
    date: -1,
    item: -1,
    quantity: -1,
    rate: -1,
    total: -1,
    month: -1,
    category: -1,
  };

  const searchLimit = Math.min(rawRows.length, 20);
  for (let index = 0; index < searchLimit; index += 1) {
    const row = rawRows[index] ?? [];
    const candidate = row.map(normalizeHeader);
    const candidateMap = buildColumnMap(candidate);
    const hasCore =
      candidateMap.date >= 0 &&
      candidateMap.item >= 0 &&
      candidateMap.quantity >= 0 &&
      (candidateMap.rate >= 0 || candidateMap.total >= 0);
    if (hasCore) {
      headerRowIndex = index;
      headers = row.map((value, columnIndex) => cellText(value) || `Column ${columnIndex + 1}`);
      map = candidateMap;
      break;
    }
    if (headerRowIndex === -1 && headerMatchScore(candidateMap) >= 4) {
      headerRowIndex = index;
      headers = row.map((value, columnIndex) => cellText(value) || `Column ${columnIndex + 1}`);
      map = candidateMap;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      "We couldn’t find the expected columns. Include Date, Item, Quantity and Rate (or Total Amount).",
    );
  }
  if (map.date < 0 || map.item < 0 || map.quantity < 0) {
    throw new Error("The sheet needs Date, Item and Quantity columns.");
  }
  if (map.rate < 0 && map.total < 0) {
    throw new Error("The sheet needs a Rate or Total Amount column.");
  }

  let blankRows = 0;
  let summaryRows = 0;
  const occurrenceByBase = new Map<string, number>();
  const parsedRows: ImportPreviewRow[] = [];
  const dataRows = rawRows.slice(headerRowIndex + 1);

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index] ?? [];
    const rowNumber = headerRowIndex + index + 2;
    if (rowIsBlank(row)) {
      blankRows += 1;
      continue;
    }
    if (isSummaryRow(row, map)) {
      summaryRows += 1;
      continue;
    }

    const rawDateCell = row[map.date];
    const rawDate = rawDateDisplay(rawDateCell);
    const date = normalizeImportDate(rawDateCell);
    const itemCell = row[map.item];
    const itemName = cellText(itemCell);
    const categoryName = inferCategoryName(
      itemName,
      map.category >= 0 ? cellText(row[map.category]) : undefined,
    );
    const quantityValue = parseNumber(row[map.quantity]);
    const rateValue = map.rate >= 0 ? parseNumber(row[map.rate]) : null;
    const totalValue = map.total >= 0 ? parseNumber(row[map.total]) : null;

    const issues: string[] = [];
    const fatal: string[] = [];
    let status: ImportRowStatus = "valid";
    let quantity: number | null = null;
    let ratePaise: number | null = null;
    let amountPaise: number | null = null;

    if (!date) {
      fatal.push(rawDate ? `“${rawDate}” isn’t a valid date.` : "The date is missing.");
    }
    if (!itemName || typeof itemCell === "number") {
      fatal.push("The item name is missing or not text.");
    }
    if (quantityValue === null || !Number.isInteger(quantityValue) || quantityValue <= 0) {
      fatal.push("Quantity must be a whole number greater than 0.");
    } else {
      quantity = quantityValue;
    }

    if (rateValue !== null && rateValue < 0) fatal.push("The rate cannot be negative.");
    if (totalValue !== null && totalValue < 0) fatal.push("The total cannot be negative.");

    if (fatal.length === 0 && quantity !== null) {
      if (rateValue !== null) {
        ratePaise = Math.round(rateValue * 100);
      } else if (totalValue !== null) {
        ratePaise = Math.round((totalValue * 100) / quantity);
        status = "corrected";
        issues.push(
          `Rate was derived from the row total (${formatMoney(ratePaise, { currency: "INR" })}).`,
        );
      } else {
        fatal.push("Add a rate or a row total so the amount can be calculated.");
      }
    }

    if (fatal.length === 0 && quantity !== null && ratePaise !== null) {
      amountPaise = Math.round(quantity * ratePaise);
      if (totalValue === null) {
        status = "corrected";
        issues.push(
          `Missing total — calculated ${formatMoney(amountPaise, { currency: "INR" })}.`,
        );
      } else {
        const providedPaise = Math.round(totalValue * 100);
        if (Math.abs(providedPaise - amountPaise) > 1) {
          status = "corrected";
          issues.push(
            `Total corrected from ${formatMoney(providedPaise, { currency: "INR" })} to ${formatMoney(amountPaise, { currency: "INR" })}.`,
          );
        }
      }
    }

    if (fatal.length > 0 || !date || !itemName || quantity === null || ratePaise === null) {
      status = "rejected";
      issues.push(...fatal);
    }

    let fingerprint: string | undefined;
    if (status !== "rejected" && date && quantity !== null && ratePaise !== null) {
      const baseFingerprint = `${date}|${itemName.trim().toLowerCase()}|${quantity}|${ratePaise}`;
      const occurrence = (occurrenceByBase.get(baseFingerprint) ?? 0) + 1;
      occurrenceByBase.set(baseFingerprint, occurrence);
      fingerprint = fingerprintFor(date, itemName, quantity, ratePaise, occurrence);
      if (existingFingerprints.has(fingerprint)) {
        status = "duplicate";
        issues.push("This row is already in your workspace from an earlier import.");
      }
    }

    parsedRows.push({
      id: newId(),
      rowNumber,
      rawDate,
      date,
      itemName,
      categoryName,
      quantity,
      rate: ratePaise,
      amount: amountPaise,
      status,
      issues,
      fingerprint,
    });
  }

  const rows = parsedRows;
  const accepted = rows.filter(
    (row) => row.status === "valid" || row.status === "corrected",
  );
  const dates = accepted.map((row) => row.date).filter((value): value is string => Boolean(value));

  return {
    fileName,
    sheetName,
    headers,
    rows,
    totalDataRows: rows.length,
    validCount: rows.filter((row) => row.status === "valid").length,
    correctedCount: rows.filter((row) => row.status === "corrected").length,
    rejectedCount: rows.filter((row) => row.status === "rejected").length,
    duplicateCount: rows.filter((row) => row.status === "duplicate").length,
    blankRows,
    summaryRows,
    importedTotal: accepted.reduce((total, row) => total + (row.amount ?? 0), 0),
    importedQuantity: accepted.reduce((total, row) => total + (row.quantity ?? 0), 0),
    dateFrom: dates.length ? dates.sort()[0] ?? null : null,
    dateTo: dates.length ? dates.sort()[dates.length - 1] ?? null : null,
  };
}

function findImportSheet(workbook: XLSX.WorkBook): {
  sheetName: string;
  rows: RawRow[];
} {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) continue;
    const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });
    if (rows.length === 0) continue;
    const headerIndex = rows.findIndex((row) => {
      const map = buildColumnMap(row.map(normalizeHeader));
      return (
        map.date >= 0 &&
        map.item >= 0 &&
        map.quantity >= 0 &&
        (map.rate >= 0 || map.total >= 0)
      );
    });
    if (headerIndex >= 0) return { sheetName, rows };
  }
  throw new Error(
    "No sheet had the expected columns. DailyBrew needs Date, Item, Quantity and Rate or Total.",
  );
}

export function parseWorkbookBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  existingFingerprints: Set<string>,
): ImportPreview {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });
  const { sheetName, rows } = findImportSheet(workbook);
  return parseWorkbookRows(rows, fileName, sheetName, existingFingerprints);
}

export function parseWorkbookText(
  text: string,
  fileName: string,
  existingFingerprints: Set<string>,
): ImportPreview {
  const workbook = XLSX.read(text, { type: "string", cellDates: false });
  const { sheetName, rows } = findImportSheet(workbook);
  return parseWorkbookRows(rows, fileName, sheetName, existingFingerprints);
}

export async function parseWorkbookFile(
  file: File,
  existingFingerprints: Set<string>,
): Promise<ImportPreview> {
  if (/\.csv$/i.test(file.name)) {
    return parseWorkbookText(await file.text(), file.name, existingFingerprints);
  }
  return parseWorkbookBuffer(await file.arrayBuffer(), file.name, existingFingerprints);
}

export async function loadSampleWorkbookFile(): Promise<File> {
  const response = await fetch(encodeURI(SAMPLE_WORKBOOK_PATH));
  if (!response.ok) throw new Error("The included 2026 tracker could not be loaded.");
  const blob = await response.blob();
  return new File([blob], SAMPLE_WORKBOOK_FILE, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}


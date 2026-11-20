import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeImportDate, parseWorkbookBuffer, parseWorkbookRows } from "@/lib/import";

function sampleWorkbookBuffer(): ArrayBuffer {
  const file = readFileSync(
    resolve(process.cwd(), "public", "Monthly Eatery Expense Tracker - 2026.xlsx"),
  );
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

describe("normalizeImportDate", () => {
  it("normalises Excel serial dates without timezone drift", () => {
    expect(normalizeImportDate(46246)).toBe("2026-08-12");
    expect(normalizeImportDate(46251)).toBe("2026-08-17");
  });

  it("normalises day-first strings, ISO timestamps and named dates", () => {
    expect(normalizeImportDate("14/08/2026")).toBe("2026-08-14");
    expect(normalizeImportDate("1/9/2026")).toBe("2026-09-01");
    expect(normalizeImportDate("2026-11-19T18:29:50.000Z")).toBe("2026-11-19");
    expect(normalizeImportDate("2 Aug 2026")).toBe("2026-08-02");
  });

  it("rejects impossible dates instead of silently rolling them over", () => {
    expect(normalizeImportDate("31/02/2026")).toBeNull();
    expect(normalizeImportDate("2026-13-04")).toBeNull();
    expect(normalizeImportDate("")).toBeNull();
  });
});

describe("parseWorkbookRows", () => {
  it("ignores blanks and summary rows, corrects totals and rejects invalid rows", () => {
    const rows = [
      ["Date", "Item", "Quantity", "Rate (INR)", "Total Amount (INR)", "Month"],
      ["2026-08-12", "Tea Medium", 2, 18, 36, "August"],
      [null, null, null, null, null, null],
      ["Total", 117, null, null, 2120, null],
      ["14/08/2026", "Toast", 2, 5, 7, null],
      ["15/08/2026", "Tea Small", 1, null, 15, null],
      ["31/02/2026", "Biscuit", 1, 5, 5, null],
    ];
    const preview = parseWorkbookRows(rows, "test.xlsx", "Sheet1", new Set());

    expect(preview.blankRows).toBe(1);
    expect(preview.summaryRows).toBe(1);
    expect(preview.validCount).toBe(1);
    expect(preview.correctedCount).toBe(2);
    expect(preview.rejectedCount).toBe(1);
    expect(preview.importedTotal).toBe(3600 + 1000 + 1500);
    expect(preview.rows).toHaveLength(4);

    const corrected = preview.rows.find((row) => row.itemName === "Toast");
    expect(corrected?.status).toBe("corrected");
    expect(corrected?.amount).toBe(1000);
    expect(corrected?.issues.join(" ")).toMatch(/Total corrected/i);

    const derivedRate = preview.rows.find((row) => row.itemName === "Tea Small");
    expect(derivedRate?.rate).toBe(1500);
    expect(derivedRate?.issues.join(" ")).toMatch(/Rate was derived/i);

    const rejected = preview.rows.find((row) => row.itemName === "Biscuit");
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.issues.join(" ")).toMatch(/isn’t a valid date/i);
  });

  it("detects rows already imported via their fingerprint", () => {
    const rows = [
      ["Date", "Item", "Quantity", "Rate", "Total"],
      ["2026-08-12", "Black Coffee", 1, 20, 20],
      ["2026-08-12", "Black Coffee", 1, 20, 20],
    ];
    const initial = parseWorkbookRows(rows, "test.xlsx", "Sheet1", new Set());
    expect(initial.validCount).toBe(2);
    const fingerprint = initial.rows[0]?.fingerprint;
    expect(fingerprint).toBeTruthy();

    const rerun = parseWorkbookRows(rows, "test.xlsx", "Sheet1", new Set([fingerprint as string]));
    expect(rerun.duplicateCount).toBe(1);
    expect(rerun.validCount).toBe(1);
  });

  it("removes duplicate detectors without dropping legitimate repeated rows", () => {
    const rows = [
      ["Date", "Item", "Quantity", "Rate", "Total"],
      ["2026-08-12", "Black Coffee", 1, 20, 20],
      ["2026-08-12", "Black Coffee", 1, 20, 20],
    ];
    const preview = parseWorkbookRows(rows, "test.xlsx", "Sheet1", new Set());
    expect(preview.duplicateCount).toBe(0);
    expect(preview.rows[0]?.fingerprint).not.toBe(preview.rows[1]?.fingerprint);
  });
});

describe("the supplied workbook", () => {
  const preview = parseWorkbookBuffer(sampleWorkbookBuffer(), "tracker.xlsx", new Set());

  it("reads every dated row and ignores blanks and the summary row", () => {
    expect(preview.totalDataRows).toBe(158);
    expect(preview.validCount).toBe(152);
    expect(preview.correctedCount).toBe(6);
    expect(preview.rejectedCount).toBe(0);
    expect(preview.summaryRows).toBe(1);
    expect(preview.dateFrom).toBe("2026-08-12");
    expect(preview.dateTo).toBe("2026-11-19");
  });

  it("recalculates missing totals while preserving the original stored rates", () => {
    expect(preview.importedTotal).toBe(766_000);
    expect(preview.importedQuantity).toBe(413);
    const corrected = preview.rows.filter((row) => row.status === "corrected");
    expect(corrected).toHaveLength(6);
    expect(corrected.every((row) => row.amount === row.quantity! * row.rate!)).toBe(true);
    expect(corrected[0]?.rowNumber).toBe(155);
  });

  it("recognises a previously imported workbook", () => {
    const fingerprint = preview.rows[0]?.fingerprint as string;
    const rerun = parseWorkbookBuffer(sampleWorkbookBuffer(), "tracker.xlsx", new Set([fingerprint]));
    expect(rerun.duplicateCount).toBe(1);
    expect(rerun.validCount).toBe(151);
  });
});

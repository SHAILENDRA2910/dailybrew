import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatQuantity,
  formatRate,
  lineTotal,
  parseAmountToPaise,
  toPaise,
} from "@/lib/money";

describe("money calculations", () => {
  it("calculates line totals in integer paise", () => {
    expect(lineTotal(3, 1800)).toBe(5400);
    expect(lineTotal(4, 500)).toBe(2000);
    expect(lineTotal(2, 2550)).toBe(5100);
  });

  it("rounds decimals safely instead of using floating point totals", () => {
    expect(toPaise(18.555)).toBe(1856);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(parseAmountToPaise("₹1,240.50")).toBe(124050);
    expect(parseAmountToPaise("18")).toBe(1800);
    expect(parseAmountToPaise("")).toBeNull();
    expect(parseAmountToPaise("abc")).toBeNull();
    expect(parseAmountToPaise(-5)).toBe(-500);
  });

  it("formats currency and compact rates for the café UI", () => {
    expect(formatMoney(5400, { currency: "INR" })).toContain("54.00");
    expect(formatRate(1800, "INR")).not.toContain(".00");
    expect(formatMoney(0, { currency: "INR", decimals: 0 })).toContain("0");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(2.5)).toBe("2.5");
  });
});

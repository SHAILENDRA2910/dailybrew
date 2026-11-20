import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCommitImport } from "@/hooks/queries";
import { getExistingFingerprints } from "@/lib/data/expenses";
import {
  loadSampleWorkbookFile,
  parseWorkbookFile,
} from "@/lib/import";
import { SAMPLE_WORKBOOK_FILE } from "@/lib/constants";
import { formatDateMedium, formatDateShort } from "@/lib/dates";
import { formatMoney, formatQuantity, formatRate } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  ImportCommitResult,
  ImportPreview,
  ImportPreviewRow,
  ImportRowStatus,
} from "@/types/domain";

type PreviewFilter = "all" | ImportRowStatus;

const statusBadge: Record<
  ImportRowStatus,
  { label: string; variant: "sage" | "caramel" | "terracotta" | "outline" }
> = {
  valid: { label: "Valid", variant: "sage" },
  corrected: { label: "Corrected", variant: "caramel" },
  rejected: { label: "Rejected", variant: "terracotta" },
  duplicate: { label: "Duplicate", variant: "outline" },
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadRejected(rows: ImportPreviewRow[], fileName: string) {
  const header = ["Row", "Raw date", "Item", "Quantity", "Rate", "Amount", "Issues"];
  const csv = [
    header.map(csvEscape).join(","),
    ...rows.map((row) =>
      [
        String(row.rowNumber),
        row.rawDate,
        row.itemName,
        row.quantity === null ? "" : formatQuantity(row.quantity),
        row.rate === null ? "" : formatMoney(row.rate, { decimals: 2 }),
        row.amount === null ? "" : formatMoney(row.amount, { decimals: 2 }),
        row.issues.join(" "),
      ]
        .map((value) => csvEscape(String(value)))
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function ImportPanel() {
  const { workspace, actorId, currency } = useWorkspaceContext();
  const commitImport = useCommitImport(workspace.id, actorId);
  const [params, setParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoLoadedRef = useRef(false);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [resultFile, setResultFile] = useState("");
  const [rejectedRows, setRejectedRows] = useState<ImportPreviewRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<PreviewFilter>("all");

  const parseFile = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        setError("That file is larger than 10 MB. Try a smaller workbook.");
        return;
      }
      setParsing(true);
      setError(null);
      setResult(null);
      setRejectedRows([]);
      try {
        const existing = await getExistingFingerprints(workspace.id);
        const parsed = await parseWorkbookFile(file, existing);
        setPreview(parsed);
        setFilter("all");
        window.setTimeout(() => {
          document.getElementById("import-preview")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 80);
      } catch (parseError) {
        setPreview(null);
        setError(
          parseError instanceof Error
            ? parseError.message
            : "The workbook could not be read. Check that it is a valid Excel or CSV file.",
        );
      } finally {
        setParsing(false);
      }
    },
    [workspace.id],
  );

  const loadSample = useCallback(async () => {
    setParsing(true);
    setError(null);
    try {
      const file = await loadSampleWorkbookFile();
      await parseFile(file);
    } catch (sampleError) {
      setError(
        sampleError instanceof Error
          ? sampleError.message
          : "The included tracker could not be loaded.",
      );
      setParsing(false);
    }
  }, [parseFile]);

  useEffect(() => {
    if (params.get("sample") === "1" && !autoLoadedRef.current) {
      autoLoadedRef.current = true;
      void loadSample();
      const next = new URLSearchParams(params);
      next.delete("sample");
      setParams(next, { replace: true });
    }
  }, [params, loadSample, setParams]);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void parseFile(file);
  };

  const counts = useMemo(() => {
    if (!preview) return null;
    return {
      valid: preview.validCount,
      corrected: preview.correctedCount,
      rejected: preview.rejectedCount,
      duplicate: preview.duplicateCount,
    };
  }, [preview]);

  const visibleRows = useMemo(() => {
    if (!preview) return [];
    if (filter === "all") return preview.rows;
    return preview.rows.filter((row) => row.status === filter);
  }, [preview, filter]);

  const acceptedCount = preview ? preview.validCount + preview.correctedCount : 0;

  const handleCommit = async () => {
    if (!preview) return;
    const accepted = preview.rows.filter(
      (row) =>
        (row.status === "valid" || row.status === "corrected") &&
        row.date &&
        row.quantity !== null &&
        row.rate !== null &&
        row.fingerprint,
    );
    if (accepted.length === 0) {
      toast.info("There are no valid new rows to import.");
      return;
    }
    setRejectedRows(preview.rows.filter((row) => row.status === "rejected"));
    try {
      const imported = await commitImport.mutateAsync({
        rows: accepted.map((row) => ({
          expenseDate: row.date as string,
          itemName: row.itemName,
          categoryName: row.categoryName,
          quantity: row.quantity as number,
          unitRate: row.rate as number,
          fingerprint: row.fingerprint as string,
        })),
        options: {
          fileName: preview.fileName,
          rejectedCount: preview.rejectedCount,
        },
      });
      setResult(imported);
      setResultFile(preview.fileName);
      setPreview(null);
      toast.success(
        `Imported ${imported.imported} ${imported.imported === 1 ? "expense" : "expenses"}.`,
      );
    } catch (commitError) {
      toast.error(
        commitError instanceof Error ? commitError.message : "The import could not be completed.",
      );
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#EDF1E8] text-sage-deep">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-espresso">
                Import complete.
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mocha">
                {resultFile} is now part of your ledger. Saved rates are snapshotted exactly as
                they appear in the workbook.
              </p>
            </div>
            <Button asChild>
              <Link to="/expenses">
                View expenses
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Imported", value: result.imported },
              { label: "Duplicates skipped", value: result.skippedDuplicates },
              { label: "Rejected rows", value: result.rejected },
              { label: "New items", value: result.itemsCreated },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-line bg-[#FDF9F2] px-3 py-3">
                <p className="amount text-[20px] font-semibold text-espresso">{item.value}</p>
                <p className="mt-0.5 text-[10px] text-mocha">{item.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-cream/30 px-3 py-2.5 text-[11px] leading-relaxed text-mocha">
            <Info className="mt-0.5 size-3.5 shrink-0 text-caramel" aria-hidden="true" />
            Re-importing the same workbook is safe: each row carries a fingerprint, so duplicates
            are skipped instead of added twice.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setResult(null)}>
              Import another workbook
            </Button>
            {rejectedRows.length > 0 ? (
              <Button
                variant="ghost"
                onClick={() => downloadRejected(rejectedRows, "dailybrew-rejected-rows.csv")}
              >
                <Download className="size-4" aria-hidden="true" />
                Download {rejectedRows.length} rejected{" "}
                {rejectedRows.length === 1 ? "row" : "rows"}
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        id="workbook-file"
        type="file"
        accept=".xlsx,.xls,.csv"
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <label
        htmlFor="workbook-file"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed bg-white px-5 py-9 text-center transition-colors sm:py-11",
          dragging ? "border-caramel bg-cream/25" : "border-cream-deep/80 hover:border-caramel/70",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-cream/50 text-coffee">
          {parsing ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-5" aria-hidden="true" />
          )}
        </span>
        <p className="mt-3 text-[14px] font-medium text-espresso">
          {parsing ? "Reading your workbook…" : "Drop your Excel or CSV file here"}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-mocha">
          We’ll show every row, every correction and every rejected record before saving.
        </p>
        <span className="mt-4 inline-flex h-9 items-center rounded-full border border-line bg-white px-4 text-[12px] font-medium text-espresso">
          Choose a file
        </span>
        <p className="mt-2 text-[10px] text-mocha">.xlsx, .xls or .csv · up to 10 MB</p>
      </label>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#F0D5CA] bg-[#F8E4DC]/70 px-3.5 py-3 text-[11.5px] leading-relaxed text-[#8E4C33]"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {!preview ? (
        <Card className="flex flex-col gap-4 border-cream-deep/50 bg-[#FBF6EE] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-sage-deep">
              <FileSpreadsheet className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-medium text-espresso">Your 2026 tracker is included</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-mocha">
                {SAMPLE_WORKBOOK_FILE} · preview the real rows before importing.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 bg-white"
            onClick={() => void loadSample()}
            disabled={parsing}
          >
            {parsing ? "Loading…" : "Preview tracker"}
          </Button>
        </Card>
      ) : null}

      {preview ? (
        <Card id="import-preview" className="scroll-mt-24 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line/80 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EDF1E8] text-sage-deep">
                <FileSpreadsheet className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-espresso">
                  {preview.fileName}
                </p>
                <p className="mt-0.5 text-[10.5px] text-mocha">
                  {preview.sheetName} · {preview.totalDataRows} data rows ·{" "}
                  {preview.blankRows} blank skipped · {preview.summaryRows} summary rows ignored
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setPreview(null);
                setError(null);
                fileInputRef.current?.click();
              }}
            >
              Choose another
            </Button>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {counts
                ? (
                    [
                      { key: "valid" as const, label: "Valid", value: counts.valid, tone: "sage" },
                      {
                        key: "corrected" as const,
                        label: "Corrected",
                        value: counts.corrected,
                        tone: "caramel",
                      },
                      {
                        key: "rejected" as const,
                        label: "Rejected",
                        value: counts.rejected,
                        tone: "terracotta",
                      },
                      {
                        key: "duplicate" as const,
                        label: "Duplicates",
                        value: counts.duplicate,
                        tone: "outline",
                      },
                    ] as const
                  ).map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() =>
                        setFilter(
                          filter === entry.key
                            ? "all"
                            : entry.key,
                        )
                      }
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-colors",
                        filter === entry.key
                          ? "border-espresso bg-cream/25"
                          : "border-line bg-[#FDF9F2] hover:border-cream-deep",
                      )}
                    >
                      <p className="amount text-[19px] font-semibold text-espresso">{entry.value}</p>
                      <p className="mt-0.5 text-[10px] text-mocha">{entry.label}</p>
                    </button>
                  ))
                : null}
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-xl bg-cream/25 px-3.5 py-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.11em] text-mocha">
                  Ready to import
                </p>
                <p className="amount mt-0.5 text-[20px] font-semibold text-espresso">
                  {formatMoney(preview.importedTotal, { currency })}
                </p>
                <p className="text-[10.5px] text-mocha">
                  {formatQuantity(preview.importedQuantity)} items · {acceptedCount} rows
                </p>
              </div>
              <div className="text-right text-[10.5px] text-mocha">
                {preview.dateFrom && preview.dateTo ? (
                  <p>
                    {formatDateMedium(preview.dateFrom)} – {formatDateMedium(preview.dateTo)}
                  </p>
                ) : (
                  <p>No usable dates</p>
                )}
                <p className="mt-0.5">Month and year derived from each date</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {preview.headers.slice(0, 8).map((header) => (
                <span
                  key={header}
                  className="rounded-full border border-line bg-white px-2.5 py-1 text-[10px] text-coffee"
                >
                  {header}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-espresso">
                {filter === "all" ? "All rows" : `${statusBadge[filter].label} rows`}{" "}
                <span className="font-normal text-mocha">({visibleRows.length})</span>
              </p>
              {preview.rejectedCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() =>
                    downloadRejected(
                      preview.rows.filter((row) => row.status === "rejected"),
                      "dailybrew-rejected-rows.csv",
                    )
                  }
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download rejected
                </Button>
              ) : null}
            </div>

            <div className="mt-2 max-h-[420px] overflow-y-auto rounded-xl border border-line">
              {visibleRows.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-mocha">
                  No rows in this category.
                </p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {visibleRows.map((row) => {
                    const badge = statusBadge[row.status];
                    return (
                      <li key={row.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span className="shrink-0 text-[9.5px] text-mocha">#{row.rowNumber}</span>
                            <p
                              className={cn(
                                "truncate text-[12px] font-medium",
                                row.status === "rejected" ? "text-[#8E4C33]" : "text-espresso",
                              )}
                            >
                              {row.itemName || "Missing item"}
                            </p>
                            <span className="shrink-0 text-[10px] text-mocha">
                              {row.date ? formatDateShort(row.date) : row.rawDate || "No date"}
                            </span>
                          </div>
                          <Badge variant={badge.variant} className="shrink-0">
                            {badge.label}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px] text-mocha">
                          <span>
                            {row.quantity === null ? "—" : formatQuantity(row.quantity)} ×{" "}
                            {row.rate === null ? "—" : formatRate(row.rate, currency)} ·{" "}
                            {row.categoryName}
                          </span>
                          <span className="amount text-coffee">
                            {row.amount === null ? "—" : formatMoney(row.amount, { currency })}
                          </span>
                        </div>
                        {row.issues.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {row.issues.map((issue) => (
                              <li
                                key={issue}
                                className={cn(
                                  "text-[10px] leading-snug",
                                  row.status === "rejected" ? "text-terracotta" : "text-[#8B5C31]",
                                )}
                              >
                                {issue}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10.5px] leading-relaxed text-mocha">
                {preview.rejectedCount > 0
                  ? `${preview.rejectedCount} problematic ${preview.rejectedCount === 1 ? "row stays" : "rows stay"} out of the import — review them above.`
                  : "Every usable row will be imported with its original item name and rate."}
              </p>
              <Button
                onClick={() => void handleCommit()}
                disabled={acceptedCount === 0 || commitImport.isPending}
                isLoading={commitImport.isPending}
                className="shrink-0"
              >
                Import {acceptedCount} {acceptedCount === 1 ? "row" : "rows"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <p className="flex items-start gap-2 px-1 text-[10.5px] leading-relaxed text-mocha">
        <Info className="mt-0.5 size-3.5 shrink-0 text-caramel" aria-hidden="true" />
        Imported rows become individual expense entries. Your current catalogue rates are not
        changed, and past entries are never rewritten.
      </p>
    </div>
  );
}

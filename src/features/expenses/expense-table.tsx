import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ExpenseLineRow } from "@/features/expenses/rows";
import { formatDateMedium } from "@/lib/dates";
import { formatMoney, formatQuantity, formatRate } from "@/lib/money";
import type { Expense } from "@/types/domain";

interface ExpenseTableProps {
  rows: ExpenseLineRow[];
  currency: string;
  onDelete: (expense: Expense) => void;
}

export function ExpenseTable({ rows, currency, onDelete }: ExpenseTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);

  const columns = useMemo<ColumnDef<ExpenseLineRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[12px] text-coffee">
            {formatDateMedium(row.original.date)}
          </span>
        ),
      },
      {
        accessorKey: "itemName",
        header: "Item",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="max-w-[220px] truncate font-medium text-espresso">
              {row.original.itemName}
            </p>
            {row.original.note ? (
              <p className="mt-0.5 max-w-[220px] truncate text-[10.5px] text-mocha">
                {row.original.note}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-coffee">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: row.original.categoryColor }}
              aria-hidden="true"
            />
            {row.original.categoryName}
          </span>
        ),
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ row }) => (
          <span className="amount text-[12px] text-coffee">
            {formatQuantity(row.original.quantity)}
          </span>
        ),
      },
      {
        accessorKey: "unitRate",
        header: "Rate",
        cell: ({ row }) => (
          <span className="amount whitespace-nowrap text-[12px] text-mocha">
            {formatRate(row.original.unitRate, currency)}
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="amount whitespace-nowrap text-[12.5px] font-medium text-espresso">
            {formatMoney(row.original.amount, { currency })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-0.5">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Edit expense">
              <Link to={`/expenses/${row.original.expenseId}/edit`}>
                <Pencil className="size-3.5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hover:bg-[#F8E4DC] hover:text-terracotta"
              aria-label="Delete expense"
              onClick={() => onDelete(row.original.expense)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [currency, onDelete],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className="hidden md:block">
      <div className="overflow-x-auto rounded-[20px] border border-line bg-white shadow-card">
        <table className="w-full min-w-[720px] border-collapse text-left text-[12.5px]">
          <thead className="border-b border-line bg-[#FBF6EE]/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.08em] text-mocha"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 transition-colors hover:text-espresso"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line/70">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-mocha">
                  No expense lines match these filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[#FDF9F2]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-[11px] text-mocha">
          Showing{" "}
          <span className="font-medium text-coffee">
            {rows.length === 0 ? 0 : table.getState().pagination.pageIndex * 25 + 1}–
            {Math.min(rows.length, (table.getState().pagination.pageIndex + 1) * 25)}
          </span>{" "}
          of {rows.length} item lines
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="min-w-[4rem] text-center text-[11px] text-mocha">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyRateChanges,
  createCategory,
  createItem,
  listCategories,
  listItems,
  listPriceHistory,
  setItemActive,
  updateCategory,
  updateItem,
  type RateChange,
} from "@/lib/data/catalog";
import { closeMonth, listClosures, reopenMonth } from "@/lib/data/closures";
import {
  deleteReceipt,
  getReceipt,
  saveReceipt,
} from "@/lib/data/receipts";
import {
  commitImportRows,
  createExpense,
  deleteExpense,
  listExpenses,
  restoreExpense,
  updateExpense,
  type ImportCommitOptions,
  type ImportCommitRow,
} from "@/lib/data/expenses";
import {
  deleteBudget,
  listBudgets,
  saveBudget,
} from "@/lib/data/budgets";
import {
  loadWorkspaceState,
  resetAllLocalData,
  setupWorkspace,
  updateProfileRecord,
  updateWorkspaceRecord,
  type SetupWorkspaceInput,
} from "@/lib/data/workspace";
import type {
  BudgetInput,
  CategoryInput,
  ExpenseInput,
  ItemInput,
  Workspace,
} from "@/types/domain";

export const queryKeys = {
  workspaceState: ["workspace-state"] as const,
  categories: (workspaceId: string) => ["categories", workspaceId] as const,
  items: (workspaceId: string) => ["items", workspaceId] as const,
  expenses: (workspaceId: string) => ["expenses", workspaceId] as const,
  budgets: (workspaceId: string) => ["budgets", workspaceId] as const,
  priceHistory: (itemId: string) => ["price-history", itemId] as const,
  monthClosures: (workspaceId: string) => ["month-closures", workspaceId] as const,
  receipt: (expenseId: string) => ["receipt", expenseId] as const,
};

export function useWorkspaceState() {
  return useQuery({
    queryKey: queryKeys.workspaceState,
    queryFn: loadWorkspaceState,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSetupWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetupWorkspaceInput) => setupWorkspace(input),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.workspaceState, state);
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories(state.workspace.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(state.workspace.id) });
    },
  });
}

export function useCategories(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: () => listCategories(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useItems(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.items(workspaceId),
    queryFn: () => listItems(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useExpenses(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.expenses(workspaceId),
    queryFn: () => listExpenses(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useBudgets(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.budgets(workspaceId),
    queryFn: () => listBudgets(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useMonthClosures(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.monthClosures(workspaceId),
    queryFn: () => listClosures(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useCloseMonth(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => closeMonth(workspaceId, month),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monthClosures(workspaceId) });
    },
  });
}

export function useReopenMonth(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (month: string) => reopenMonth(workspaceId, month),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monthClosures(workspaceId) });
    },
  });
}

export function useReceipt(expenseId: string | null) {
  return useQuery({
    queryKey: queryKeys.receipt(expenseId ?? "none"),
    queryFn: () => getReceipt(expenseId ?? ""),
    enabled: Boolean(expenseId),
    staleTime: 10_000,
  });
}

export function useSaveReceipt(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      expenseId,
      blob,
      mimeType,
    }: {
      expenseId: string;
      blob: Blob;
      mimeType: string;
    }) => saveReceipt(workspaceId, expenseId, blob, mimeType),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipt(receipt.expense_id) });
    },
  });
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => deleteReceipt(expenseId),
    onSuccess: (_result, expenseId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipt(expenseId) });
    },
  });
}

export function useApplyRateChanges(workspaceId: string, changedBy: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      changes,
      effectiveDate,
    }: {
      changes: RateChange[];
      effectiveDate: string;
    }) => applyRateChanges(workspaceId, changes, effectiveDate, changedBy),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: ["price-history"] });
    },
  });
}

export function usePriceHistory(itemId: string | null) {
  return useQuery({
    queryKey: queryKeys.priceHistory(itemId ?? "none"),
    queryFn: () => listPriceHistory(itemId ?? ""),
    enabled: Boolean(itemId),
  });
}

export function useCreateExpense(workspaceId: string, profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpenseInput) => createExpense(workspaceId, profileId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(workspaceId) });
    },
  });
}

export function useUpdateExpense(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExpenseInput }) =>
      updateExpense(workspaceId, id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(workspaceId) });
    },
  });
}

export function useDeleteExpense(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(workspaceId) });
    },
  });
}

export function useRestoreExpense(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expense: Parameters<typeof restoreExpense>[0]) => restoreExpense(expense),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(workspaceId) });
    },
  });
}

export function useCreateCategory(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) => createCategory(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(workspaceId) });
    },
  });
}

export function useUpdateCategory(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; isActive?: boolean };
    }) => updateCategory(workspaceId, id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(workspaceId) });
    },
  });
}

export function useCreateItem(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ItemInput) => createItem(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) });
    },
  });
}

export function useUpdateItem(workspaceId: string, changedBy: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ItemInput }) =>
      updateItem(workspaceId, id, input, changedBy),
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.priceHistory(item.id) });
    },
  });
}

export function useSetItemActive(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setItemActive(workspaceId, id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(workspaceId) });
    },
  });
}

export function useSaveBudget(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BudgetInput) => saveBudget(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets(workspaceId) });
    },
  });
}

export function useDeleteBudget(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets(workspaceId) });
    },
  });
}

export function useCommitImport(workspaceId: string, profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      rows,
      options,
    }: {
      rows: ImportCommitRow[];
      options: ImportCommitOptions;
    }) => commitImportRows(workspaceId, profileId, rows, options),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.items(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Pick<Workspace, "name" | "currency" | "timezone"> &
        Partial<Pick<Workspace, "date_format">>;
    }) => updateWorkspaceRecord(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceState });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { fullName: string; email?: string } }) =>
      updateProfileRecord(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceState });
    },
  });
}

export function useResetAllData() {
  return useMutation({
    mutationFn: () => resetAllLocalData(),
  });
}

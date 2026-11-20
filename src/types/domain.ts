export type DateFormatPreference = "dmy" | "medium";

export interface Workspace {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  /** Display preference only; stored dates always stay ISO. */
  date_format?: DateFormatPreference;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  workspace_id: string;
  category_id: string;
  name: string;
  /** Stored in paise to keep money calculations integer-safe. */
  default_rate: number;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  workspace_id: string;
  /** Local calendar date in YYYY-MM-DD form. */
  expense_date: string;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  import_fingerprint?: string;
  import_source?: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  item_id: string;
  item_name_snapshot: string;
  quantity: number;
  /** Stored in paise. Historical snapshot; never rewritten by item price edits. */
  unit_rate: number;
  /** Stored in paise. */
  line_total: number;
  created_at: string;
}

export interface Expense extends Transaction {
  items: TransactionItem[];
}

export interface MonthlyBudget {
  id: string;
  workspace_id: string;
  year: number;
  month: number;
  /** Stored in paise. */
  budget_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ItemPriceHistory {
  id: string;
  item_id: string;
  /** Stored in paise. */
  old_rate: number;
  new_rate: number;
  effective_date: string;
  changed_by: string;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  workspace_id: string;
  file_name: string;
  imported_at: string;
  imported_count: number;
  skipped_count: number;
  rejected_count: number;
}

export interface WorkspaceState {
  workspace: Workspace;
  profile: Profile | null;
}

export interface MonthClosure {
  id: string;
  workspace_id: string;
  /** Local calendar month in YYYY-MM form. */
  month: string;
  closed_at: string;
  /** Stored in paise. Total at the moment the month was closed. */
  closing_total: number;
  entry_count: number;
}

export interface ReceiptRecord {
  /** One receipt per transaction. */
  expense_id: string;
  workspace_id: string;
  blob: Blob;
  mime_type: string;
  created_at: string;
}

export interface ExpenseLineInput {
  itemId: string;
  quantity: number;
  /** Stored in paise. */
  unitRate: number;
}

export interface ExpenseInput {
  expenseDate: string;
  note: string;
  items: ExpenseLineInput[];
}

export interface CategoryInput {
  name: string;
  isActive?: boolean;
}

export interface ItemInput {
  name: string;
  categoryId: string;
  /** Stored in paise. */
  defaultRate: number;
  unit: string;
  isActive?: boolean;
}

export interface BudgetInput {
  year: number;
  month: number;
  /** Stored in paise. */
  amount: number;
}

export type ImportRowStatus = "valid" | "corrected" | "rejected" | "duplicate";

export interface ImportPreviewRow {
  id: string;
  rowNumber: number;
  rawDate: string;
  date: string | null;
  itemName: string;
  categoryName: string;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  status: ImportRowStatus;
  issues: string[];
  fingerprint?: string;
}

export interface ImportPreview {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: ImportPreviewRow[];
  totalDataRows: number;
  validCount: number;
  correctedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  blankRows: number;
  summaryRows: number;
  importedTotal: number;
  importedQuantity: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface ImportCommitResult {
  imported: number;
  skippedDuplicates: number;
  rejected: number;
  itemsCreated: number;
  categoriesCreated: number;
}

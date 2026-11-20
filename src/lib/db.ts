import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Category,
  ImportBatch,
  Item,
  ItemPriceHistory,
  MonthClosure,
  MonthlyBudget,
  Profile,
  ReceiptRecord,
  Transaction,
  TransactionItem,
  Workspace,
} from "@/types/domain";

export interface MetaRecord {
  key: string;
  value: string;
}

export interface DailyBrewDBSchema extends DBSchema {
  meta: {
    key: string;
    value: MetaRecord;
  };
  workspaces: {
    key: string;
    value: Workspace;
  };
  profiles: {
    key: string;
    value: Profile;
  };
  categories: {
    key: string;
    value: Category;
    indexes: { workspace: string };
  };
  items: {
    key: string;
    value: Item;
    indexes: { workspace: string; category: string };
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { workspace: string; date: string; fingerprint: string };
  };
  transaction_items: {
    key: string;
    value: TransactionItem;
    indexes: { transaction: string; item: string };
  };
  monthly_budgets: {
    key: string;
    value: MonthlyBudget;
    indexes: { workspace: string };
  };
  item_price_history: {
    key: string;
    value: ItemPriceHistory;
    indexes: { item: string; workspace: string };
  };
  imports: {
    key: string;
    value: ImportBatch;
    indexes: { workspace: string };
  };
  month_closures: {
    key: string;
    value: MonthClosure;
    indexes: { workspace: string };
  };
  receipts: {
    key: string;
    value: ReceiptRecord;
    indexes: { workspace: string };
  };
}

export type DailyBrewDatabase = IDBPDatabase<DailyBrewDBSchema>;

export const DB_NAME = "dailybrew";
const DB_VERSION = 2;

let dbPromise: Promise<DailyBrewDatabase> | null = null;

export function getDb(): Promise<DailyBrewDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<DailyBrewDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("meta", { keyPath: "key" });
          db.createObjectStore("workspaces", { keyPath: "id" });
          db.createObjectStore("profiles", { keyPath: "id" });

          const categories = db.createObjectStore("categories", { keyPath: "id" });
          categories.createIndex("workspace", "workspace_id");

          const items = db.createObjectStore("items", { keyPath: "id" });
          items.createIndex("workspace", "workspace_id");
          items.createIndex("category", "category_id");

          const transactions = db.createObjectStore("transactions", { keyPath: "id" });
          transactions.createIndex("workspace", "workspace_id");
          transactions.createIndex("date", "expense_date");
          transactions.createIndex("fingerprint", "import_fingerprint");

          const transactionItems = db.createObjectStore("transaction_items", { keyPath: "id" });
          transactionItems.createIndex("transaction", "transaction_id");
          transactionItems.createIndex("item", "item_id");

          const budgets = db.createObjectStore("monthly_budgets", { keyPath: "id" });
          budgets.createIndex("workspace", "workspace_id");

          const priceHistory = db.createObjectStore("item_price_history", { keyPath: "id" });
          priceHistory.createIndex("item", "item_id");
          priceHistory.createIndex("workspace", "workspace_id");

          const imports = db.createObjectStore("imports", { keyPath: "id" });
          imports.createIndex("workspace", "workspace_id");
        }

        if (oldVersion < 2) {
          const closures = db.createObjectStore("month_closures", { keyPath: "id" });
          closures.createIndex("workspace", "workspace_id");

          const receipts = db.createObjectStore("receipts", { keyPath: "expense_id" });
          receipts.createIndex("workspace", "workspace_id");
        }
      },
      blocked() {
        // A previous tab still has the database open; it will close on versionchange.
      },
      blocking() {
        void closeDb();
      },
    });
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

export async function resetDatabase(): Promise<void> {
  await closeDb();
  await deleteDB(DB_NAME);
}

export const META_KEYS = {
  workspaceId: "workspace_id",
  profileId: "profile_id",
  onboardedAt: "onboarded_at",
  lastImport: "last_import",
} as const;

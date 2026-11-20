import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Splash } from "@/components/shared/splash";
import { OnboardingGate, PrintGate, RequireWorkspace } from "@/app/require-workspace";

const HomePage = lazy(() => import("@/features/dashboard/home-page"));
const ExpensesPage = lazy(() => import("@/features/expenses/expenses-page"));
const AddExpensePage = lazy(() => import("@/features/expenses/add-expense-page"));
const EditExpensePage = lazy(() => import("@/features/expenses/edit-expense-page"));
const ReportsPage = lazy(() => import("@/features/reports/reports-page"));
const ItemsPage = lazy(() => import("@/features/items/items-page"));
const BudgetsPage = lazy(() => import("@/features/budgets/budgets-page"));
const DataPage = lazy(() => import("@/features/import/data-page"));
const SettingsPage = lazy(() => import("@/features/settings/settings-page"));
const MorePage = lazy(() => import("@/features/more/more-page"));
const NotFoundPage = lazy(() => import("@/features/not-found/not-found-page"));

export function AppRoutes() {
  return (
    <Suspense fallback={<Splash label="Opening DailyBrew" />}>
      <Routes>
        <Route path="/welcome" element={<OnboardingGate />} />
        <Route path="/print" element={<PrintGate />} />
        <Route element={<RequireWorkspace />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="expenses/:id/edit" element={<EditExpensePage />} />
            <Route path="add" element={<AddExpensePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

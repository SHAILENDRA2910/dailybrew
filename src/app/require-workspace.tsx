import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Splash } from "@/components/shared/splash";
import { WorkspaceProvider } from "@/app/workspace-context";
import { useWorkspaceState } from "@/hooks/queries";
import { setDateFormatPreference } from "@/lib/dates";

const OnboardingPage = lazy(() => import("@/features/auth/onboarding-page"));

function WorkspaceLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ivory p-5">
      <Card className="w-full max-w-sm p-6 text-center">
        <h1 className="text-lg font-semibold text-espresso">Your workspace didn’t open.</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-mocha">
          Browser storage may be unavailable or blocked. Allow site data for DailyBrew and try
          again.
        </p>
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </Card>
    </div>
  );
}

export function RequireWorkspace({ children }: { children?: ReactNode }) {
  const query = useWorkspaceState();

  if (query.isLoading) return <Splash />;
  if (query.isError) {
    return <WorkspaceLoadError onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return <Navigate to="/welcome" replace />;

  // Set before children render so every formatter follows the saved preference.
  setDateFormatPreference(query.data.workspace.date_format);

  return (
    <WorkspaceProvider state={query.data}>
      {children ?? <Outlet />}
    </WorkspaceProvider>
  );
}

export function OnboardingGate() {
  const query = useWorkspaceState();

  if (query.isLoading) return <Splash label="Setting the table" />;
  if (query.isError) {
    return <WorkspaceLoadError onRetry={() => void query.refetch()} />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-ivory">
          <Skeleton className="h-40 w-80 max-w-[90vw]" />
        </div>
      }
    >
      <OnboardingPage />
    </Suspense>
  );
}

export function PrintGate() {
  return (
    <RequireWorkspace>
      <Suspense fallback={<Splash label="Preparing your report" />}>
        <PrintReportPage />
      </Suspense>
    </RequireWorkspace>
  );
}

const PrintReportPage = lazy(() => import("@/features/print/print-report-page"));

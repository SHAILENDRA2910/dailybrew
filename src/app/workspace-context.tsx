import { createContext, useContext, type ReactNode } from "react";
import type { Workspace, WorkspaceState } from "@/types/domain";

interface WorkspaceContextValue extends WorkspaceState {
  actorId: string;
  currency: string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  state,
  children,
}: {
  state: WorkspaceState;
  children: ReactNode;
}) {
  const value: WorkspaceContextValue = {
    ...state,
    actorId: state.profile?.id ?? "local-owner",
    currency: state.workspace.currency,
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used inside the workspace shell.");
  }
  return context;
}

export function useActiveWorkspace(): Workspace {
  return useWorkspaceContext().workspace;
}

export function useCurrency(): string {
  return useWorkspaceContext().currency;
}

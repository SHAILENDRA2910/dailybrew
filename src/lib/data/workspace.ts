import { getDb, META_KEYS, resetDatabase } from "@/lib/db";
import { seedCatalog } from "@/lib/seed";
import { newId, normalizeName, nowISO } from "@/lib/utils";
import type { Workspace, WorkspaceState } from "@/types/domain";

export interface SetupWorkspaceInput {
  fullName: string;
  workspaceName: string;
  email?: string;
  currency?: string;
  timezone?: string;
}

export async function loadWorkspaceState(): Promise<WorkspaceState | null> {
  const db = await getDb();
  const workspaceId = await db.get("meta", META_KEYS.workspaceId);
  if (!workspaceId) return null;

  const stored = await db.get("workspaces", workspaceId.value);
  if (!stored) return null;
  // Workspaces created before the preference existed default to day-first.
  const workspace: Workspace = { ...stored, date_format: stored.date_format ?? "dmy" };

  const profileId = await db.get("meta", META_KEYS.profileId);
  const profile = profileId ? ((await db.get("profiles", profileId.value)) ?? null) : null;

  return { workspace, profile };
}

export async function setupWorkspace(input: SetupWorkspaceInput): Promise<WorkspaceState> {
  const db = await getDb();
  const createdAt = nowISO();
  const workspace: Workspace = {
    id: newId(),
    name: normalizeName(input.workspaceName),
    currency: input.currency ?? "INR",
    timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Kolkata",
    date_format: "dmy",
    created_at: createdAt,
  };
  const profile = {
    id: newId(),
    full_name: normalizeName(input.fullName),
    email: input.email?.trim() ?? "",
    created_at: createdAt,
  };

  const tx = db.transaction(["workspaces", "profiles", "meta"], "readwrite");
  await Promise.all([
    tx.objectStore("workspaces").put(workspace),
    tx.objectStore("profiles").put(profile),
    tx.objectStore("meta").put({ key: META_KEYS.workspaceId, value: workspace.id }),
    tx.objectStore("meta").put({ key: META_KEYS.profileId, value: profile.id }),
    tx.objectStore("meta").put({ key: META_KEYS.onboardedAt, value: createdAt }),
  ]);
  await tx.done;

  await seedCatalog(workspace.id);

  return { workspace, profile };
}

export async function updateWorkspaceRecord(
  id: string,
  patch: Pick<Workspace, "name" | "currency" | "timezone"> &
    Partial<Pick<Workspace, "date_format">>,
): Promise<Workspace> {
  const db = await getDb();
  const current = await db.get("workspaces", id);
  if (!current) throw new Error("Workspace not found.");
  const updated: Workspace = {
    ...current,
    name: normalizeName(patch.name),
    currency: patch.currency,
    timezone: patch.timezone,
    date_format: patch.date_format ?? current.date_format ?? "dmy",
  };
  await db.put("workspaces", updated);
  return updated;
}

export async function updateProfileRecord(
  id: string,
  patch: { fullName: string; email?: string },
): Promise<void> {
  const db = await getDb();
  const current = await db.get("profiles", id);
  if (!current) throw new Error("Profile not found.");
  await db.put("profiles", {
    ...current,
    full_name: normalizeName(patch.fullName),
    email: patch.email?.trim() ?? current.email,
  });
}

export async function resetAllLocalData(): Promise<void> {
  await resetDatabase();
}

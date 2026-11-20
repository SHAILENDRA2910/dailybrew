import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Database,
  Download,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspaceContext } from "@/app/workspace-context";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedControl, type SegmentedOption } from "@/components/shared/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldError, FieldHint, Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useResetAllData,
  useUpdateProfile,
  useUpdateWorkspace,
} from "@/hooks/queries";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { APP_VERSION, CURRENCIES } from "@/lib/constants";
import {
  buildBackup,
  describeBackup,
  parseBackupFile,
  restoreBackup,
  type BackupFile,
  type BackupSummary,
} from "@/lib/data/backup";
import { initials } from "@/lib/utils";
import {
  profileSchema,
  workspaceSettingsSchema,
  type ProfileValues,
  type WorkspaceSettingsValues,
} from "@/lib/validations";

const dateFormatOptions: SegmentedOption<WorkspaceSettingsValues["dateFormat"]>[] = [
  { value: "dmy", label: "20/11/2026" },
  { value: "medium", label: "20 Nov 2026" },
];

function InstallGuide() {
  const { canPrompt, isStandalone, promptInstall } = useInstallPrompt();

  const install = async () => {
    const result = await promptInstall();
    if (result === "accepted") {
      toast.success("DailyBrew installed. Look for the cup on your home screen.");
    } else if (result === "dismissed") {
      toast.info("Installation dismissed. You can try again anytime.");
    } else {
      toast.info("Use your browser’s install or Add to Home Screen option below.");
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cream/50 text-coffee">
          <Smartphone className="size-4" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-espresso">Install DailyBrew</h2>
            {isStandalone ? (
              <Badge variant="sage">
                <Check className="size-3" aria-hidden="true" />
                Installed
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-mocha">
            Add DailyBrew to your home screen for a full-screen, app-like experience that opens
            offline.
          </p>
        </div>
      </div>

      {!isStandalone && canPrompt ? (
        <Button className="mt-4 w-full" onClick={() => void install()}>
          <Download className="size-4" aria-hidden="true" />
          Install app
        </Button>
      ) : null}

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl bg-[#FBF6EE] p-3.5">
          <p className="text-[11.5px] font-semibold text-espresso">iPhone & iPad</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[10.5px] leading-relaxed text-mocha">
            <li>Open DailyBrew in Safari.</li>
            <li>Tap the Share button.</li>
            <li>Choose “Add to Home Screen”.</li>
            <li>Tap Add, then open it from your home screen.</li>
          </ol>
        </div>
        <div className="rounded-xl bg-[#FBF6EE] p-3.5">
          <p className="text-[11.5px] font-semibold text-espresso">Android</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[10.5px] leading-relaxed text-mocha">
            <li>Open DailyBrew in Chrome.</li>
            <li>Tap the three-dot menu.</li>
            <li>Choose “Install app” or “Add to Home screen”.</li>
            <li>Confirm and launch from your home screen.</li>
          </ol>
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-mocha">
        Installing a PWA is not an App Store or Play Store listing. It uses the browser version of
        DailyBrew and keeps your data in this browser.
      </p>
    </Card>
  );
}

export default function SettingsPage() {
  const { workspace, profile, currency } = useWorkspaceContext();
  const updateProfile = useUpdateProfile();
  const updateWorkspace = useUpdateWorkspace();
  const resetAll = useResetAllData();
  const online = useOnlineStatus();
  const { isStandalone } = useInstallPrompt();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [storageUsage, setStorageUsage] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    backup: BackupFile;
    summary: BackupSummary;
  } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name ?? "",
      email: profile?.email ?? "",
    },
  });

  const workspaceForm = useForm<WorkspaceSettingsValues>({
    resolver: zodResolver(workspaceSettingsSchema),
    defaultValues: {
      name: workspace.name,
      currency: workspace.currency,
      timezone: workspace.timezone,
      dateFormat: workspace.date_format ?? "dmy",
    },
  });

  useEffect(() => {
    profileForm.reset({
      fullName: profile?.full_name ?? "",
      email: profile?.email ?? "",
    });
  }, [profile?.full_name, profile?.email, profileForm]);

  useEffect(() => {
    workspaceForm.reset({
      name: workspace.name,
      currency: workspace.currency,
      timezone: workspace.timezone,
      dateFormat: workspace.date_format ?? "dmy",
    });
  }, [
    workspace.name,
    workspace.currency,
    workspace.timezone,
    workspace.date_format,
    workspaceForm,
  ]);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    let cancelled = false;
    void navigator.storage.estimate().then((estimate) => {
      if (cancelled || !estimate.usage) return;
      const megabytes = estimate.usage / (1024 * 1024);
      setStorageUsage(
        megabytes < 0.1 ? "Less than 0.1 MB" : `${megabytes.toFixed(1)} MB used`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = async (values: ProfileValues) => {
    if (!profile) return;
    try {
      await updateProfile.mutateAsync({
        id: profile.id,
        patch: { fullName: values.fullName, email: values.email ?? "" },
      });
      toast.success("Your profile is updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The profile could not be saved.");
    }
  };

  const saveWorkspace = async (values: WorkspaceSettingsValues) => {
    try {
      await updateWorkspace.mutateAsync({
        id: workspace.id,
        patch: {
          name: values.name,
          currency: values.currency,
          timezone: values.timezone,
          date_format: values.dateFormat,
        },
      });
      toast.success("Workspace settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workspace could not be saved.");
    }
  };

  const downloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const backup = await buildBackup(workspace.id);
      const summary = describeBackup(backup);
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dailybrew-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success("Backup downloaded.", {
        description: `${summary.entries} entries, ${summary.items} items and ${summary.receipts} receipt photos.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The backup could not be created.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        throw new Error("That file isn’t valid JSON. Choose a DailyBrew backup file.");
      }
      const backup = parseBackupFile(raw);
      setPendingRestore({ backup, summary: describeBackup(backup) });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That file could not be read as a backup.",
      );
    }
  };

  const confirmRestore = async () => {
    if (!pendingRestore || isRestoring) return;
    setIsRestoring(true);
    try {
      await restoreBackup(pendingRestore.backup);
      toast.success("Backup restored. Opening your workspace…");
      window.setTimeout(() => window.location.replace("/"), 300);
    } catch (error) {
      setIsRestoring(false);
      toast.error(
        error instanceof Error ? error.message : "The backup could not be restored.",
      );
    }
  };

  const deleteEverything = async () => {
    try {
      await resetAll.mutateAsync();
      toast.success("Local data deleted.");
      window.location.replace("/welcome");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The data could not be deleted.");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace & account"
        title="Settings"
        description="Your workspace, your device, your data. Adjust the details that follow the ledger."
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-cream/70 text-[13px] font-semibold text-espresso">
                {initials(profile?.full_name || "DailyBrew Owner")}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-semibold text-espresso">
                  {profile?.full_name || "Your profile"}
                </h2>
                <p className="truncate text-[11px] text-mocha">
                  {profile?.email || "Stored on this device"}
                </p>
              </div>
              <Badge variant="sage">Local owner</Badge>
            </div>

            <form
              className="mt-5 space-y-3"
              onSubmit={profileForm.handleSubmit(saveProfile)}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="settings-name">Full name</Label>
                <Input
                  id="settings-name"
                  autoComplete="name"
                  aria-invalid={Boolean(profileForm.formState.errors.fullName)}
                  {...profileForm.register("fullName")}
                />
                <FieldError>{profileForm.formState.errors.fullName?.message}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-email">
                  Email <span className="font-normal text-mocha">(optional)</span>
                </Label>
                <Input
                  id="settings-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(profileForm.formState.errors.email)}
                  {...profileForm.register("email")}
                />
                <FieldError>{profileForm.formState.errors.email?.message}</FieldError>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  isLoading={updateProfile.isPending}
                  disabled={updateProfile.isPending}
                >
                  Save profile
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="text-[14px] font-semibold text-espresso">Workspace</h2>
            <p className="mt-0.5 text-[11.5px] text-mocha">
              The name and currency shown throughout DailyBrew.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={workspaceForm.handleSubmit(saveWorkspace)}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  aria-invalid={Boolean(workspaceForm.formState.errors.name)}
                  {...workspaceForm.register("name")}
                />
                <FieldError>{workspaceForm.formState.errors.name?.message}</FieldError>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="workspace-currency">Currency</Label>
                  <Controller
                    control={workspaceForm.control}
                    name="currency"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="workspace-currency" aria-label="Workspace currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((entry) => (
                            <SelectItem key={entry.code} value={entry.code}>
                              {entry.symbol} · {entry.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldHint>Used for display and exports.</FieldHint>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="workspace-timezone">Timezone</Label>
                  <Input
                    id="workspace-timezone"
                    aria-invalid={Boolean(workspaceForm.formState.errors.timezone)}
                    {...workspaceForm.register("timezone")}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      workspaceForm.setValue(
                        "timezone",
                        Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Kolkata",
                        { shouldDirty: true },
                      )
                    }
                    className="text-[10.5px] font-medium text-coffee underline-offset-2 hover:text-espresso hover:underline"
                  >
                    Use device timezone
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Date format</Label>
                <SegmentedControl
                  options={dateFormatOptions}
                  value={workspaceForm.watch("dateFormat")}
                  onChange={(value) =>
                    workspaceForm.setValue("dateFormat", value, { shouldDirty: true })
                  }
                  ariaLabel="Date format"
                />
                <FieldHint>
                  Used for every date in the app. Stored dates and totals never change.
                </FieldHint>
              </div>

              <p className="text-[10px] leading-relaxed text-mocha">
                Current display currency: {currency}. Existing expense amounts are not converted
                when the currency label changes.
              </p>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  isLoading={updateWorkspace.isPending}
                  disabled={updateWorkspace.isPending}
                >
                  Save workspace
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <InstallGuide />

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-parchment text-coffee">
                <Database className="size-4" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <h2 className="text-[14px] font-semibold text-espresso">Data & storage</h2>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-mocha">
                  DailyBrew is local-first. Your workspace stays in this browser using IndexedDB,
                  and the app shell is cached for offline use.
                </p>
              </div>
            </div>

            <dl className="mt-4 space-y-2 border-t border-line/70 pt-3 text-[11.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-mocha">Storage</dt>
                <dd className="text-espresso">On this device</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-mocha">Network</dt>
                <dd className="flex items-center gap-1.5 text-espresso">
                  <span
                    className={online ? "size-1.5 rounded-full bg-sage" : "size-1.5 rounded-full bg-caramel"}
                    aria-hidden="true"
                  />
                  {online ? "Online" : "Offline · still working"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-mocha">App mode</dt>
                <dd className="text-espresso">{isStandalone ? "Installed" : "Browser"}</dd>
              </div>
              {storageUsage ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-mocha">Approx. usage</dt>
                  <dd className="text-espresso">{storageUsage}</dd>
                </div>
              ) : null}
            </dl>

            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link to="/data">
                <Download className="size-3.5" aria-hidden="true" />
                Export or import your data
              </Link>
            </Button>

            <div className="mt-3 rounded-xl border border-line bg-[#FBF6EE] p-3.5">
              <p className="text-[11.5px] font-medium text-espresso">Full backup</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-mocha">
                One JSON file with every entry, item, rate change, budget, closed month and receipt
                photo. Restoring replaces the workspace in this browser.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white"
                  onClick={() => void downloadBackup()}
                  isLoading={isBackingUp}
                  disabled={isBackingUp}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white"
                  onClick={() => backupInputRef.current?.click()}
                  disabled={isRestoring}
                >
                  <Upload className="size-3.5" aria-hidden="true" />
                  Restore backup
                </Button>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  aria-label="Choose a DailyBrew backup file"
                  onChange={(event) => void chooseBackup(event)}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#F0D5CA] bg-[#FBF1EC] p-3.5">
              <p className="text-[11.5px] font-medium text-[#8E4C33]">Delete all local data</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-[#8E4C33]/80">
                Removes the workspace, expenses, catalogue and budgets from this browser. Export a
                copy first — this cannot be undone.
              </p>
              <Button
                variant="ghost-danger"
                size="sm"
                className="mt-2.5 border border-[#F0D5CA] bg-white/60"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete data
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-sage" aria-hidden="true" />
              <h2 className="text-[14px] font-semibold text-espresso">About DailyBrew</h2>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-mocha">
              A warm, quick expense ledger for tea, coffee, snacks and everyday eatery spending.
              No account, no feed, no noise.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline">Version {APP_VERSION}</Badge>
              <Badge variant="outline">Local-first PWA</Badge>
              <Badge variant="outline">INR-friendly</Badge>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-mocha">
              Your ledger can move with you: use Import & export to take a CSV or Excel backup.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open && !isRestoring) setPendingRestore(null);
        }}
        title="Replace this workspace with the backup?"
        description={
          pendingRestore
            ? `“${pendingRestore.summary.workspaceName}” with ${pendingRestore.summary.entries} entries, ${pendingRestore.summary.items} items and ${pendingRestore.summary.receipts} receipt photos will replace everything currently in this browser. This cannot be undone.`
            : ""
        }
        confirmLabel={isRestoring ? "Restoring…" : "Restore backup"}
        destructive
        onConfirm={() => void confirmRestore()}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete all local data?"
        description="This permanently removes this workspace, its expenses, items, rates and budgets from this browser. Export a backup first if you might need it."
        confirmLabel="Delete everything"
        destructive
        onConfirm={() => void deleteEverything()}
      />
    </div>
  );
}

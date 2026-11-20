import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, FileSpreadsheet, ShieldCheck, Sparkles } from "lucide-react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspaceState, useSetupWorkspace } from "@/hooks/queries";
import { Brand, CoffeeIllustration } from "@/components/shared/brand";
import { Splash } from "@/components/shared/splash";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SAMPLE_WORKBOOK_FILE } from "@/lib/constants";
import { workspaceSetupSchema, type WorkspaceSetupValues } from "@/lib/validations";

export default function OnboardingPage() {
  const { data, isLoading } = useWorkspaceState();
  const setup = useSetupWorkspace();
  const navigate = useNavigate();
  const submittingRef = useRef(false);

  const form = useForm<WorkspaceSetupValues>({
    resolver: zodResolver(workspaceSetupSchema),
    defaultValues: {
      fullName: "",
      workspaceName: "My DailyBrew",
      importHistory: true,
    },
  });

  if (isLoading) return <Splash label="Setting the table" />;
  // After a successful setup the query updates immediately; let the explicit
  // destination below win instead of racing it with this redirect.
  if (data && !submittingRef.current) return <Navigate to="/" replace />;

  const importHistory = form.watch("importHistory");

  const onSubmit = async (values: WorkspaceSetupValues) => {
    submittingRef.current = true;
    try {
      await setup.mutateAsync({
        fullName: values.fullName,
        workspaceName: values.workspaceName,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currency: "INR",
      });
      toast.success("Your workspace is ready.");
      navigate(values.importHistory ? "/data?sample=1" : "/", { replace: true });
    } catch (error) {
      submittingRef.current = false;
      toast.error(error instanceof Error ? error.message : "The workspace could not be created.");
    }
  };

  return (
    <div className="min-h-dvh bg-ivory lg:grid lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-espresso px-12 py-11 text-ivory lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(circle at 78% 12%, rgba(197,139,82,0.22), transparent 40%), radial-gradient(circle at 12% 88%, rgba(112,69,47,0.5), transparent 45%)",
          }}
        />
        <div className="relative">
          <Brand tone="light" />
        </div>

        <div className="relative mx-auto w-full max-w-[440px]">
          <CoffeeIllustration className="mx-auto max-w-[330px] opacity-95" />
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.2em] text-caramel">
            The daily tally, reimagined
          </p>
          <h1 className="mt-3 text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] text-ivory">
            A quiet ledger for your loudest little habits.
          </h1>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-cream/75">
            From the first chai to the last biscuit. DailyBrew turns your Excel ritual into
            something you actually enjoy opening.
          </p>
          <div className="mt-8 flex items-center gap-3 border-t border-ivory/10 pt-5 text-[11.5px] text-cream/60">
            <Sparkles className="size-4 text-caramel" aria-hidden="true" />
            Built for one hand, one moment, one honest total.
          </div>
        </div>

        <p className="relative text-[11px] text-cream/45">
          DailyBrew · Tea, coffee & eatery expense manager
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col px-5 pb-10 pt-safe sm:px-8 lg:justify-center lg:px-14 lg:py-12">
        <div className="mb-10 flex items-center justify-between lg:hidden">
          <Brand />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] text-mocha">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Private by default
          </span>
        </div>

        <div className="mx-auto w-full max-w-[410px]">
          <div className="mb-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-caramel">
              Set up in a minute
            </p>
            <h1 className="mt-2.5 text-[30px] font-semibold leading-[1.12] tracking-[-0.04em] text-espresso sm:text-[34px]">
              Let’s make this
              <br />
              your DailyBrew.
            </h1>
            <p className="mt-3 text-[13.5px] leading-relaxed text-mocha">
              No account, no passwords. Your expense ledger lives on this device and keeps
              working offline.
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="fullName">Your name</Label>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="e.g. Aarav"
                aria-invalid={Boolean(form.formState.errors.fullName)}
                {...form.register("fullName")}
              />
              <FieldError>{form.formState.errors.fullName?.message}</FieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input
                id="workspaceName"
                autoComplete="organization"
                placeholder="My DailyBrew"
                aria-invalid={Boolean(form.formState.errors.workspaceName)}
                {...form.register("workspaceName")}
              />
              <FieldHint>For you, or the little team you share a pantry with.</FieldHint>
              <FieldError>{form.formState.errors.workspaceName?.message}</FieldError>
            </div>

            <div className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#EDF1E8] text-sage-deep">
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="importHistory"
                    className="block text-[13px] font-medium text-espresso"
                  >
                    Bring in your 2026 tracker
                  </label>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-mocha">
                    We’ll preview every row from{" "}
                    <span className="font-medium text-coffee">{SAMPLE_WORKBOOK_FILE}</span> before
                    importing anything.
                  </p>
                </div>
                <Switch
                  id="importHistory"
                  checked={importHistory}
                  onCheckedChange={(checked) =>
                    form.setValue("importHistory", checked, { shouldDirty: true })
                  }
                  aria-label="Import the included 2026 tracker"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full justify-between px-5"
              isLoading={setup.isPending}
              disabled={setup.isPending}
            >
              Open my workspace
              {!setup.isPending ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
            </Button>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-mocha">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-sage" aria-hidden="true" />
              Expenses, rates and budgets are stored locally in your browser. Export or back up
              your workbook anytime.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

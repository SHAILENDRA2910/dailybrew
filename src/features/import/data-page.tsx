import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedControl, type SegmentedOption } from "@/components/shared/segmented-control";
import { ImportPanel } from "@/features/import/import-panel";
import { ExportPanel } from "@/features/import/export-panel";
import { useWorkspaceContext } from "@/app/workspace-context";
import { useExpenses } from "@/hooks/queries";

type DataTab = "import" | "export";

const tabs: SegmentedOption<DataTab>[] = [
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
];

export default function DataPage() {
  const { workspace } = useWorkspaceContext();
  const { data: expenses = [] } = useExpenses(workspace.id);
  const [tab, setTab] = useState<DataTab>("import");

  return (
    <div>
      <PageHeader
        eyebrow="Your workbook"
        title="Import & export"
        description="Bring your Excel history in, or take your ledger anywhere. Nothing leaves this device unless you download it."
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          options={tabs}
          value={tab}
          onChange={setTab}
          ariaLabel="Import or export"
          className="sm:w-[260px]"
        />
        <p className="flex items-center gap-1.5 text-[10.5px] text-mocha">
          <ArrowLeftRight className="size-3.5 text-caramel" aria-hidden="true" />
          {expenses.length} saved {expenses.length === 1 ? "entry" : "entries"} in this workspace
        </p>
      </div>

      {tab === "import" ? <ImportPanel /> : <ExportPanel />}
    </div>
  );
}

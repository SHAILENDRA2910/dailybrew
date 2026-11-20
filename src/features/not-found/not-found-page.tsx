import { Coffee } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <EmptyState
        icon={Coffee}
        eyebrow="404"
        title="This page isn’t on the menu."
        description="The link may be old, or the page may have moved. Your ledger is still warm and waiting."
        action={
          <Button asChild>
            <Link to="/">Back to home</Link>
          </Button>
        }
        className="w-full max-w-lg"
      />
    </div>
  );
}

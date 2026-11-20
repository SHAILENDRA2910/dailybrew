import { RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("DailyBrew render error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ivory p-5">
        <Card className="w-full max-w-md p-7 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-caramel">
            Something spilled
          </p>
          <h1 className="mt-2 text-xl font-semibold text-espresso">
            This screen didn’t brew correctly.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-mocha">
            Your saved expenses are safe on this device. Reload to pick up where you left off.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RotateCcw className="size-4" aria-hidden="true" />
              Reload app
            </Button>
            <Button variant="outline" asChild>
              <a href="/">Go to dashboard</a>
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}

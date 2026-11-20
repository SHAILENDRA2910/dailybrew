import { CalendarDays } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  containerClassName?: string;
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("relative", containerClassName)}>
      <CalendarDays
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mocha"
        aria-hidden="true"
      />
      <Input ref={ref} type="date" className={cn("pl-10", className)} {...props} />
    </div>
  ),
);
DateField.displayName = "DateField";

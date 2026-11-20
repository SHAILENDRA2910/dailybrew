import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-base text-espresso shadow-[inset_0_1px_2px_rgba(56,37,29,0.03)] transition-colors placeholder:text-mocha/55 focus:border-caramel focus:outline-none focus:ring-2 focus:ring-caramel/20 disabled:cursor-not-allowed disabled:bg-parchment/60 disabled:text-mocha",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-none rounded-xl border border-line bg-white px-3.5 py-3 text-base leading-relaxed text-espresso shadow-[inset_0_1px_2px_rgba(56,37,29,0.03)] transition-colors placeholder:text-mocha/55 focus:border-caramel focus:outline-none focus:ring-2 focus:ring-caramel/20 disabled:bg-parchment/60",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

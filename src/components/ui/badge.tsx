import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-parchment text-coffee",
        cream: "bg-cream/60 text-espresso",
        sage: "bg-mint text-sage-deep",
        caramel: "bg-[#F7EAD9] text-[#8B5C31]",
        terracotta: "bg-[#F8E4DC] text-[#8E4C33]",
        coffee: "bg-[#F2E6DC] text-coffee",
        outline: "border border-line bg-white/70 text-mocha",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

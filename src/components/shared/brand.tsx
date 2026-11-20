import { cn } from "@/lib/utils";

export function CupMark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const inverted = tone === "light";
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill={inverted ? "#FAF6EF" : "#38251D"} />
      <path
        d="M27.5 15.5c3 0 4.7 1.6 4.7 3.9s-1.8 3.9-4.6 3.9"
        fill="none"
        stroke={inverted ? "#38251D" : "#FAF6EF"}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M10.6 14.2h15.8v5.6c0 3.6-2.8 6.3-6.3 6.3h-3.2c-3.5 0-6.3-2.7-6.3-6.3z"
        fill={inverted ? "#38251D" : "#FAF6EF"}
      />
      <ellipse cx="18.5" cy="14.2" rx="7.9" ry="1.5" fill="#C58B52" />
      <rect x="9.2" y="12.6" width="18.6" height="2.4" rx="1.2" fill={inverted ? "#E9D7B9" : "#E9D7B9"} />
      <path
        d="M16.8 9c-1.5-1.9 1.4-2.9 0-4.8"
        fill="none"
        stroke="#C58B52"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="steam-line"
      />
      <path
        d="M21.8 8.2c-1.5-1.9 1.4-2.9 0-4.8"
        fill="none"
        stroke="#C58B52"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="steam-line"
        style={{ animationDelay: "0.6s" }}
        opacity="0.7"
      />
    </svg>
  );
}

export function Brand({
  className,
  markClassName,
  wordmarkClassName,
  tone = "dark",
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CupMark className={cn("size-9", markClassName)} tone={tone} />
      <span
        className={cn(
          "text-[17px] font-semibold tracking-[-0.04em]",
          tone === "light" ? "text-ivory" : "text-espresso",
          wordmarkClassName,
        )}
      >
        DailyBrew<span className="text-caramel">.</span>
      </span>
    </span>
  );
}

export function CoffeeIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 260" className={cn("w-full", className)} aria-hidden="true">
      <circle cx="160" cy="128" r="112" fill="#F0E2CB" opacity="0.55" />
      <circle cx="160" cy="128" r="86" fill="#E9D7B9" opacity="0.45" />
      <ellipse cx="160" cy="212" rx="86" ry="12" fill="#38251D" opacity="0.08" />
      <path
        d="M248 114c28 0 44 17 44 38s-17 38-44 38"
        fill="none"
        stroke="#38251D"
        strokeWidth="11"
        strokeLinecap="round"
        opacity="0.82"
      />
      <path
        d="M94 106h152v64c0 39-30 68-68 68h-16c-38 0-68-29-68-68z"
        fill="#38251D"
      />
      <ellipse cx="170" cy="106" rx="76" ry="13" fill="#70452F" />
      <rect x="86" y="97" width="168" height="16" rx="8" fill="#E9D7B9" />
      <path
        d="M142 74c-11-14 10-22 0-36"
        fill="none"
        stroke="#B86B4B"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M178 66c-11-14 10-22 0-36"
        fill="none"
        stroke="#C58B52"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M214 76c-11-14 10-22 0-36"
        fill="none"
        stroke="#78866B"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function CoffeeRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={cn("size-60", className)} aria-hidden="true">
      <circle cx="120" cy="120" r="106" fill="none" stroke="#E9D7B9" strokeOpacity="0.13" strokeWidth="1.5" />
      <circle cx="120" cy="120" r="78" fill="none" stroke="#C58B52" strokeOpacity="0.2" strokeWidth="26" />
      <circle cx="120" cy="120" r="44" fill="none" stroke="#FAF6EF" strokeOpacity="0.06" strokeWidth="1" />
      <path
        d="M36 182c52-8 68-34 108-31s52 22 82 12"
        fill="none"
        stroke="#C58B52"
        strokeOpacity="0.16"
        strokeWidth="1.5"
      />
    </svg>
  );
}

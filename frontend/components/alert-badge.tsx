import { cn } from "@/lib/utils";
import { getThreatColor } from "@/lib/utils";

interface AlertBadgeProps {
  level: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

export default function AlertBadge({ level, size = "md", pulse = false }: AlertBadgeProps) {
  const colors = getThreatColor(level);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase",
        colors.bg,
        colors.text,
        colors.border,
        "border",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm"
      )}
    >
      <span
        className={cn("rounded-full", colors.dot, pulse && "animate-pulse",
          size === "sm" && "h-1.5 w-1.5",
          size === "md" && "h-2 w-2",
          size === "lg" && "h-2.5 w-2.5"
        )}
      />
      {level}
    </span>
  );
}

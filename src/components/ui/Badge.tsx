import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "gold" | "success" | "danger" | "info" | "pink" | "orange" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  gold: "bg-gold-dim text-gold-light border-gold/30",
  success: "bg-success/15 text-success border-success/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-info/15 text-info border-info/30",
  pink: "bg-pink/15 text-pink border-pink/30",
  orange: "bg-warn/15 text-warn border-warn/30",
  neutral: "bg-surface2 text-textDim border-border",
};

export default function Badge({ className, tone = "neutral", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-badge border px-3 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

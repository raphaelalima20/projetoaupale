import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export default function Card({ className, padded = true, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-card shadow-soft",
        padded && "p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

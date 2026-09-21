import { formatSpecialties } from "@/lib/specialties";
import { cn } from "@/lib/utils";

interface SpecialtyTextProps {
  specialty: string | null | undefined;
  fallback?: string;
  className?: string;
}

/** Renders the comma-separated specialty list, truncated with a native tooltip on hover. */
export default function SpecialtyText({
  specialty,
  fallback = "Colaboradora",
  className,
}: SpecialtyTextProps) {
  const text = formatSpecialties(specialty);
  if (!text) {
    return <span className={className}>{fallback}</span>;
  }
  return (
    <span className={cn("truncate", className)} title={text}>
      {text}
    </span>
  );
}

import { formatCurrency, cn } from "@/lib/utils";

interface ServicePriceLabelProps {
  price: number;
  isVariablePrice: boolean;
  className?: string;
  /** Client-facing contexts need the "A partir de" flag to read clearly, not as a subtle aside. */
  prominent?: boolean;
}

export default function ServicePriceLabel({
  price,
  isVariablePrice,
  className,
  prominent = false,
}: ServicePriceLabelProps) {
  if (!isVariablePrice) {
    return <span className={className}>{formatCurrency(price)}</span>;
  }

  if (prominent) {
    return (
      <span className={cn("flex flex-col items-end", className)}>
        <span className="rounded-badge border border-gold/40 bg-gold-dim px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-light">
          A partir de
        </span>
        <span className="mt-1">{formatCurrency(price)}</span>
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="text-xs font-normal text-textDim">A partir de </span>
      {formatCurrency(price)}
    </span>
  );
}

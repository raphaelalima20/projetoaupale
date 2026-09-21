import { formatCurrency } from "./utils";

/** Plain-text price label, for contexts that can't render JSX (e.g. <option> text). */
export function formatServicePriceText(price: number, isVariablePrice: boolean): string {
  return isVariablePrice ? `A partir de ${formatCurrency(price)}` : formatCurrency(price);
}

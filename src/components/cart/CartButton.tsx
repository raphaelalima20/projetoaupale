"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";
import { formatCurrency, cn } from "@/lib/utils";

export default function CartButton() {
  const { totalItems, totalAmount } = useCart();

  if (totalItems === 0) {
    return (
      <Link
        href="/cliente/carrinho"
        aria-label="Carrinho"
        className="relative rounded-btn p-2 text-textDim transition duration-200 hover:bg-surface2 hover:text-text"
      >
        <ShoppingCart size={20} strokeWidth={1.75} />
      </Link>
    );
  }

  return (
    <Link
      href="/cliente/carrinho"
      className={cn(
        "relative flex items-center gap-2 rounded-badge border border-gold bg-gold-dim px-3 py-1.5 text-gold-light",
        "animate-fadeIn"
      )}
    >
      <span className="relative">
        <ShoppingCart size={18} strokeWidth={1.75} />
        <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
          {totalItems}
        </span>
      </span>
      <span className="hidden text-sm font-medium sm:inline">{formatCurrency(totalAmount)}</span>
    </Link>
  );
}

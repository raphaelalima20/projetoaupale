"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";

export type CartItemKind = "produto" | "pacote";

export interface CartItem {
  key: string;
  kind: CartItemKind;
  refId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string | null;
  maxQuantity?: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, qty: number) => void;
  clear: () => void;
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

/**
 * Cart state lives only in memory (no localStorage — closing the tab clears it,
 * which is the expected behavior for this walk-in-friendly booking app).
 */
export default function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(item: Omit<CartItem, "quantity">, qty = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.key === item.key);
      if (existing) {
        const nextQty = item.maxQuantity
          ? Math.min(existing.quantity + qty, item.maxQuantity)
          : existing.quantity + qty;
        return prev.map((i) => (i.key === item.key ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateQuantity(key: string, qty: number) {
    if (qty <= 0) {
      removeItem(key);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, quantity: i.maxQuantity ? Math.min(qty, i.maxQuantity) : qty } : i
      )
    );
  }

  function clear() {
    setItems([]);
  }

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalAmount = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clear, totalItems, totalAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

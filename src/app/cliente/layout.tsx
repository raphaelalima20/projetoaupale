import { ReactNode } from "react";
import ClientTopBar from "@/components/layout/ClientTopBar";
import CartProvider from "@/components/cart/CartProvider";

export default function ClienteLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-background">
        <ClientTopBar />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </CartProvider>
  );
}

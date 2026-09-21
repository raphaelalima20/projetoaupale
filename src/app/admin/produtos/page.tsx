"use client";

import { useState } from "react";
import { Plus, ShoppingBag } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ProductCard from "@/components/products/ProductCard";
import ProductFormModal from "@/components/products/ProductFormModal";
import QuickSaleModal from "@/components/products/QuickSaleModal";
import OrderManagement from "@/components/products/OrderManagement";
import { useProducts } from "@/lib/hooks/useProducts";
import { useCartOrders } from "@/lib/hooks/useCartOrders";
import { sortProducts } from "@/lib/products";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types/database";

type Tab = "produtos" | "pedidos";

export default function ProdutosPage() {
  const { products, loading, refetch } = useProducts();
  const { orders, refetch: refetchOrders } = useCartOrders();
  const [tab, setTab] = useState<Tab>("produtos");
  const [formProduct, setFormProduct] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);

  const sorted = sortProducts(products);
  const pendingCount = orders.filter((o) => o.status === "pendente").length;

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Produtos"
        subtitle={`${products.length} produto${products.length === 1 ? "" : "s"} cadastrado${
          products.length === 1 ? "" : "s"
        }`}
        actions={
          tab === "produtos" && (
            <Button
              onClick={() => {
                setFormProduct(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              Novo Produto
            </Button>
          )
        }
      />

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("produtos")}
          className={cn(
            "rounded-badge border px-4 py-2 text-sm font-medium transition duration-200",
            tab === "produtos"
              ? "border-gold bg-gold-dim text-gold-light"
              : "border-border text-textDim hover:border-gold/40 hover:text-text"
          )}
        >
          Produtos
        </button>
        <button
          onClick={() => setTab("pedidos")}
          className={cn(
            "relative rounded-badge border px-4 py-2 text-sm font-medium transition duration-200",
            tab === "pedidos"
              ? "border-gold bg-gold-dim text-gold-light"
              : "border-border text-textDim hover:border-gold/40 hover:text-text"
          )}
        >
          Pedidos Online
          {pendingCount > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {tab === "produtos" ? (
        loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBag size={28} className="text-textDim" strokeWidth={1.5} />
            <p className="text-sm text-textDim">Nenhum produto cadastrado ainda</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {sorted.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="admin"
                onEdit={() => {
                  setFormProduct(product);
                  setFormOpen(true);
                }}
                onSell={() => setSaleProduct(product)}
              />
            ))}
          </div>
        )
      ) : (
        <OrderManagement orders={orders} onChanged={refetchOrders} />
      )}

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
        product={formProduct}
      />
      <QuickSaleModal
        open={!!saleProduct}
        onClose={() => setSaleProduct(null)}
        onSold={refetch}
        product={saleProduct}
      />
    </div>
  );
}

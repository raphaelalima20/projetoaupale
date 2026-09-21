"use client";

import { useState } from "react";
import { AlertTriangle, Download, Package, PenLine, ShoppingBag } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import StockAdjustModal from "@/components/products/StockAdjustModal";
import { useProducts } from "@/lib/hooks/useProducts";
import { isLowStock, sortByStockUrgency } from "@/lib/products";
import { generateStockReportPdf } from "@/lib/pdf";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/lib/types/database";

export default function EstoquePage() {
  const { products, loading, refetch } = useProducts();
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  const active = products.filter((p) => p.is_active);
  const lowStockProducts = active.filter(isLowStock);
  const sorted = sortByStockUrgency(active);

  function handleExport() {
    generateStockReportPdf({
      rows: sorted.map((p) => ({
        name: p.name,
        brand: p.brand ?? "-",
        stock: p.stock_quantity,
        minStock: p.min_stock_alert ?? 5,
        price: p.price,
        lowStock: isLowStock(p),
      })),
      generatedAt: new Date(),
    });
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Estoque"
        subtitle="Controle de quantidades"
        actions={
          <Button variant="secondary" onClick={handleExport} disabled={loading || sorted.length === 0}>
            <Download size={16} />
            Exportar PDF
          </Button>
        }
      />

      {!loading && lowStockProducts.length > 0 && (
        <Card className="mb-6 border-danger/30 bg-danger/10">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="text-sm font-medium text-danger">
                {lowStockProducts.length} produto{lowStockProducts.length === 1 ? "" : "s"} com estoque
                baixo
              </p>
              <p className="mt-1 text-xs text-danger/80">
                {lowStockProducts.map((p) => p.name).join(", ")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : sorted.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Package size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Nenhum produto ativo cadastrado</p>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-card border border-border sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2 text-left text-xs text-textDim">
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Marca</th>
                  <th className="px-4 py-3 text-right font-medium">Estoque Atual</th>
                  <th className="px-4 py-3 text-right font-medium">Mínimo</th>
                  <th className="px-4 py-3 text-right font-medium">Preço</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-surface2">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <ShoppingBag size={16} className="text-textDim" />
                          )}
                        </div>
                        <span className="text-text">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-textDim">{p.brand ?? "—"}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        isLowStock(p) ? "text-danger" : "text-text"
                      }`}
                    >
                      {p.stock_quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-textDim">{p.min_stock_alert ?? 5}</td>
                    <td className="px-4 py-3 text-right text-textDim">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setAdjustProduct(p)}>
                        <PenLine size={14} />
                        Ajustar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 sm:hidden">
            {sorted.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-surface2">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <ShoppingBag size={18} className="text-textDim" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text">{p.name}</p>
                    <p className="text-xs text-textDim">{p.brand ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${isLowStock(p) ? "text-danger" : "text-text"}`}>
                      {p.stock_quantity} un.
                    </p>
                    <p className="text-xs text-textDim">mín. {p.min_stock_alert ?? 5}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdjustProduct(p)}
                  className="mt-3 w-full"
                >
                  <PenLine size={14} />
                  Ajustar Estoque
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      <StockAdjustModal
        open={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onSaved={refetch}
        product={adjustProduct}
      />
    </div>
  );
}

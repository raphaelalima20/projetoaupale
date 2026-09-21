"use client";

import { ShoppingBag, ShoppingCart, Zap } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { isLowStock } from "@/lib/products";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product } from "@/lib/types/database";

interface AdminActions {
  variant: "admin";
  onEdit: () => void;
  onSell: () => void;
}

interface CatalogActions {
  variant: "catalog";
  onAddToCart: () => void;
  onBuyNow: () => void;
}

type ProductCardProps = { product: Product } & (AdminActions | CatalogActions);

export default function ProductCard(props: ProductCardProps) {
  const { product } = props;
  const hasPromo = product.promotional_price !== null && product.promotional_price < product.price;
  const inactive = props.variant === "admin" && !product.is_active;

  return (
    <Card padded={false} className={cn("flex flex-col overflow-hidden", inactive && "opacity-50")}>
      <div className="relative aspect-square w-full bg-surface2">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag size={32} className="text-textDim" strokeWidth={1.5} />
          </div>
        )}
        {inactive && (
          <span className="absolute left-2 top-2">
            <Badge tone="neutral">Inativo</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <p className="text-sm font-medium text-text">{product.name}</p>
          {product.brand && <p className="text-xs text-textDim">{product.brand}</p>}
        </div>

        <div className="flex items-baseline gap-2">
          {hasPromo ? (
            <>
              <span className="text-xs text-textDim line-through">{formatCurrency(product.price)}</span>
              <span className="font-display text-lg text-gold-light">
                {formatCurrency(product.promotional_price)}
              </span>
            </>
          ) : (
            <span className="font-display text-lg text-gold-light">{formatCurrency(product.price)}</span>
          )}
        </div>

        {props.variant === "admin" && (
          <Badge tone={isLowStock(product) ? "danger" : "success"} className="w-fit">
            {isLowStock(product) ? `Estoque baixo: ${product.stock_quantity}` : `Estoque: ${product.stock_quantity}`}
          </Badge>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          {props.variant === "admin" ? (
            <>
              <Button variant="ghost" size="sm" onClick={props.onEdit} className="flex-1">
                Editar
              </Button>
              <Button variant="secondary" size="sm" onClick={props.onSell} className="flex-1">
                <ShoppingCart size={14} />
                Vender
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={props.onAddToCart} className="flex-1">
                <ShoppingCart size={14} />
                Adicionar
              </Button>
              <Button size="sm" onClick={props.onBuyNow} className="flex-1">
                <Zap size={14} />
                Comprar
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

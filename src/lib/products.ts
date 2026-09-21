import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadImage } from "./storage";
import type { Product } from "./types/database";

export function isLowStock(product: Pick<Product, "stock_quantity" | "min_stock_alert">): boolean {
  return product.stock_quantity < (product.min_stock_alert ?? 5);
}

/** Uploads a product photo to the 'produtos' bucket and returns its public URL. */
export async function uploadProductImage(
  supabase: SupabaseClient,
  file: File,
  productId: string
): Promise<string> {
  return uploadImage(supabase, "produtos", file, productId);
}

export function sortProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const sortA = a.sort_order ?? 0;
    const sortB = b.sort_order ?? 0;
    if (sortA !== sortB) return sortA - sortB;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

/** Products with low stock first (lowest ratio), then alphabetical — used on the Estoque page. */
export function sortByStockUrgency(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const lowA = isLowStock(a);
    const lowB = isLowStock(b);
    if (lowA !== lowB) return lowA ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

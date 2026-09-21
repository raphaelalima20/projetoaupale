"use client";

import { useEffect, useState } from "react";
import { BookOpen, Package, ShoppingBag, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import ProductCard from "@/components/products/ProductCard";
import ServicePriceLabel from "@/components/services/ServicePriceLabel";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/cart/CartProvider";
import { useToast } from "@/components/ui/Toast";
import type { Product, Service } from "@/lib/types/database";

export default function CatalogoPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [packages, setPackages] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: packageData }, { data: productData }] = await Promise.all([
        supabase
          .from("services")
          .select("*")
          .eq("type", "pacote")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .gt("stock_quantity", 0)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
      ]);
      setPackages((packageData as Service[]) ?? []);
      setProducts((productData as Product[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  function handleAddPackage(pkg: Service) {
    addItem({
      key: `pacote_${pkg.id}`,
      kind: "pacote",
      refId: pkg.id,
      name: pkg.name,
      unitPrice: pkg.price,
    });
    showToast("Pacote adicionado ao carrinho");
  }

  function handleAddProduct(product: Product) {
    addItem({
      key: `produto_${product.id}`,
      kind: "produto",
      refId: product.id,
      name: product.name,
      unitPrice: product.promotional_price ?? product.price,
      imageUrl: product.image_url,
      maxQuantity: product.stock_quantity,
    });
    showToast("Produto adicionado ao carrinho");
  }

  function handleBuyNow(product: Product) {
    handleAddProduct(product);
    router.push("/cliente/carrinho");
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Catálogo" subtitle="Conheça nossos pacotes e produtos" back />

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-text">
          <Package size={18} className="text-gold" />
          Pacotes Mensais
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : packages.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <BookOpen size={24} className="text-textDim" strokeWidth={1.5} />
            <p className="text-sm text-textDim">Nenhum pacote disponível no momento</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className="flex flex-col gap-3 border-gold/30 bg-gradient-to-br from-gold-dim to-transparent"
              >
                <div className="flex items-center justify-between">
                  <Badge tone="gold">{pkg.package_period ?? "Mensal"}</Badge>
                  <ServicePriceLabel
                    price={pkg.price}
                    isVariablePrice={pkg.is_variable_price}
                    className="font-display text-xl text-gold-light"
                  />
                </div>
                <div>
                  <p className="font-display text-lg text-text">{pkg.name}</p>
                  {pkg.package_services && (
                    <p className="mt-1 text-sm text-textDim">{pkg.package_services}</p>
                  )}
                </div>
                <Button onClick={() => handleAddPackage(pkg)} className="mt-1 w-full">
                  <ShoppingCart size={16} />
                  Adicionar ao Carrinho
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-text">
          <ShoppingBag size={18} className="text-gold" />
          Produtos
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <ShoppingBag size={24} className="text-textDim" strokeWidth={1.5} />
            <p className="text-sm text-textDim">Nenhum produto disponível no momento</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant="catalog"
                onAddToCart={() => handleAddProduct(product)}
                onBuyNow={() => handleBuyNow(product)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

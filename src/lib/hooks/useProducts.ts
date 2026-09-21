"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types/database";

/** All products (active and inactive), kept live via realtime — used by the admin screens. */
export function useProducts() {
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const channel = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetch]);

  return { products, loading, refetch };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CartOrder } from "@/lib/types/database";

/** Online cart orders, kept live via realtime — used by the admin "Pedidos Online" panel. */
export function useCartOrders() {
  const [supabase] = useState(() => createClient());
  const [orders, setOrders] = useState<CartOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cart_orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders((data as CartOrder[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const channel = supabase
      .channel("cart-orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "cart_orders" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetch]);

  return { orders, loading, refetch };
}

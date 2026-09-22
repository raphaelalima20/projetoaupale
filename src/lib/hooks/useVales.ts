"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Vale } from "@/lib/types/database";

/** All vales (admin-only, per RLS) — outstanding ones filter client-side by `commission_payment_id`. */
export function useVales() {
  const [supabase] = useState(() => createClient());
  const [vales, setVales] = useState<Vale[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("vales").select("*").order("data", { ascending: false });
    setVales((data as Vale[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const channel = supabase
      .channel("vales-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "vales" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetch]);

  return { vales, loading, refetch };
}

/** Sum of a collaborator's vales that haven't been consumed by a payment yet. */
export function outstandingValeTotal(vales: Vale[], collaboratorId: string): number {
  return vales
    .filter((v) => v.colaboradora_id === collaboratorId && !v.commission_payment_id)
    .reduce((sum, v) => sum + v.valor, 0);
}

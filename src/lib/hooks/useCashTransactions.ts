"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CashTransaction } from "@/lib/types/database";

/** Transactions for a single cash register, kept live via realtime. */
export function useCashTransactions(cashRegisterId: string | null) {
  const [supabase] = useState(() => createClient());
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!cashRegisterId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("cash_transactions")
      .select("*")
      .eq("cash_register_id", cashRegisterId)
      .order("created_at", { ascending: false });
    setTransactions((data as CashTransaction[]) ?? []);
    setLoading(false);
  }, [supabase, cashRegisterId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!cashRegisterId) return;
    const channel = supabase
      .channel(`cash-transactions-${cashRegisterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cash_transactions",
          filter: `cash_register_id=eq.${cashRegisterId}`,
        },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, cashRegisterId, refetch]);

  return { transactions, loading, refetch };
}

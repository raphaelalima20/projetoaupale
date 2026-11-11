"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CashTransaction } from "@/lib/types/database";

/**
 * Transactions for a single cash register, always read from the database (no local cache)
 * and kept live via realtime.
 *
 * The realtime subscription is intentionally NOT filtered by cash_register_id: Supabase
 * Realtime does not apply column filters to DELETE events, so a filtered channel never hears
 * about a transaction removed elsewhere (e.g. directly in the Supabase dashboard) and the
 * totals kept summing it. We listen to every change and refetch when it touches this register
 * (or is a DELETE of a row we're showing). We also refetch whenever the tab regains focus, as
 * a safety net for events missed while the socket was disconnected.
 */
export function useCashTransactions(cashRegisterId: string | null) {
  const [supabase] = useState(() => createClient());
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const idsRef = useRef<Set<string>>(new Set());

  const refetch = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!cashRegisterId) {
        setTransactions([]);
        idsRef.current = new Set();
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      const { data } = await supabase
        .from("cash_transactions")
        .select("*")
        .eq("cash_register_id", cashRegisterId)
        .order("created_at", { ascending: false });
      const list = (data as CashTransaction[]) ?? [];
      idsRef.current = new Set(list.map((t) => t.id));
      setTransactions(list);
      setLoading(false);
    },
    [supabase, cashRegisterId]
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!cashRegisterId) return;
    const channel = supabase
      .channel(`cash-transactions-${cashRegisterId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cash_transactions" },
        (payload) => {
          const row = (payload.new ?? {}) as Partial<CashTransaction>;
          const old = (payload.old ?? {}) as Partial<CashTransaction>;
          const touchesThis =
            row.cash_register_id === cashRegisterId ||
            old.cash_register_id === cashRegisterId ||
            (old.id !== undefined && idsRef.current.has(old.id));
          if (touchesThis) refetch({ silent: true });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, cashRegisterId, refetch]);

  useEffect(() => {
    if (!cashRegisterId) return;
    function onVisible() {
      if (document.visibilityState === "visible") refetch({ silent: true });
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cashRegisterId, refetch]);

  return { transactions, loading, refetch };
}

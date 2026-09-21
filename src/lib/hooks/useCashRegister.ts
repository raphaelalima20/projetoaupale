"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { CashRegister } from "@/lib/types/database";

/**
 * Multiple components mount `useOpenCashRegister` at the same time (QuickSaleModal,
 * CommissionPaymentModal, OrderManagement, the caixa page...). `createBrowserClient`
 * memoizes a single client per tab, so calling `.channel(name).on(...).subscribe()`
 * from more than one hook instance tries to add listeners to a channel that's already
 * subscribed, which throws. Subscribing exactly once at module scope and fanning the
 * event out to every hook instance's own refetch avoids that entirely.
 */
let sharedChannel: RealtimeChannel | null = null;
const refetchListeners = new Set<() => void>();

function ensureSharedChannel(supabase: ReturnType<typeof createClient>) {
  if (sharedChannel) return;
  sharedChannel = supabase
    .channel("cash-register-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "cash_register" }, () => {
      refetchListeners.forEach((listener) => listener());
    })
    .subscribe();
}

/** The currently open cash register (there's at most one), plus the most recent closed one. */
export function useOpenCashRegister() {
  const [supabase] = useState(() => createClient());
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [lastClosed, setLastClosed] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data: openData } = await supabase
      .from("cash_register")
      .select("*")
      .eq("status", "aberto")
      .maybeSingle();

    if (openData) {
      setRegister(openData as CashRegister);
    } else {
      setRegister(null);
      const { data: closedData } = await supabase
        .from("cash_register")
        .select("*")
        .eq("status", "fechado")
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastClosed((closedData as CashRegister) ?? null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    ensureSharedChannel(supabase);
    refetchListeners.add(refetch);
    return () => {
      refetchListeners.delete(refetch);
    };
  }, [supabase, refetch]);

  return { register, lastClosed, loading, refetch };
}

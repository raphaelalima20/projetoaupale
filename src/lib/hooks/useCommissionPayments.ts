"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CommissionPayment } from "@/lib/types/database";

/** All commission payments, or a single collaborator's — newest first. */
export function useCommissionPayments(collaboratorId?: string) {
  const [supabase] = useState(() => createClient());
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("commission_payments").select("*").order("paid_at", { ascending: false });
    if (collaboratorId) query = query.eq("collaborator_id", collaboratorId);
    const { data } = await query;
    setPayments((data as CommissionPayment[]) ?? []);
    setLoading(false);
  }, [supabase, collaboratorId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const channel = supabase
      .channel(collaboratorId ? `commission-payments-${collaboratorId}` : "commission-payments-all")
      .on(
        "postgres_changes",
        collaboratorId
          ? {
              event: "*",
              schema: "public",
              table: "commission_payments",
              filter: `collaborator_id=eq.${collaboratorId}`,
            }
          : { event: "*", schema: "public", table: "commission_payments" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, collaboratorId, refetch]);

  return { payments, loading, refetch };
}

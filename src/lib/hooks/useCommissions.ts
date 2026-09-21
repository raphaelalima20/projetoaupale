"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Commission } from "@/lib/types/database";

/** All commissions, or a single collaborator's — RLS already scopes collaborator sessions to their own rows. */
export function useCommissions(collaboratorId?: string) {
  const [supabase] = useState(() => createClient());
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("commissions").select("*").order("commission_date", { ascending: true });
    if (collaboratorId) query = query.eq("collaborator_id", collaboratorId);
    const { data } = await query;
    setCommissions((data as Commission[]) ?? []);
    setLoading(false);
  }, [supabase, collaboratorId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const channel = supabase
      .channel(collaboratorId ? `commissions-${collaboratorId}` : "commissions-all")
      .on(
        "postgres_changes",
        collaboratorId
          ? {
              event: "*",
              schema: "public",
              table: "commissions",
              filter: `collaborator_id=eq.${collaboratorId}`,
            }
          : { event: "*", schema: "public", table: "commissions" },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, collaboratorId, refetch]);

  return { commissions, loading, refetch };
}

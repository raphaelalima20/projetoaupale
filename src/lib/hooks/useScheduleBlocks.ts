"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ScheduleBlock } from "@/lib/types/database";

/**
 * Schedule blocks (folgas). Staff and visitors read `public_schedule_blocks`, which omits the
 * private "reason"; the admin screen passes `{ admin: true }` to read the full table.
 */
export function useScheduleBlocks({ admin = false }: { admin?: boolean } = {}) {
  const [supabase] = useState(() => createClient());
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from(admin ? "schedule_blocks" : "public_schedule_blocks")
      .select("*")
      .order("start_date", { ascending: true });
    setBlocks((data as ScheduleBlock[]) ?? []);
    setLoading(false);
  }, [supabase, admin]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { blocks, loading, refetch };
}

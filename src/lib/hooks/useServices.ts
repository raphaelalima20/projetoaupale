"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Service } from "@/lib/types/database";

/** Active services, ordered for display (packages/individual split happens at render time). */
export function useServices() {
  const [supabase] = useState(() => createClient());
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (mounted) {
        setServices((data as Service[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return { services, loading };
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";

/**
 * Active collaborators, for grid columns and selectors. Reads the `public_collaborators` view
 * (id, name, specialty, photo, color) so CPF, address and invite tokens are never exposed —
 * and it works for visitors without login (public booking) too.
 */
export function useCollaborators() {
  const [supabase] = useState(() => createClient());
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("public_collaborators")
        .select("*")
        .order("full_name", { ascending: true });
      if (mounted) {
        setCollaborators((data as Profile[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return { collaborators, loading };
}

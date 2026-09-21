"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Appointment } from "@/lib/types/database";

/** Fetches appointments for a single day and keeps them live via realtime. */
export function useAppointmentsByDate(dateISO: string | null) {
  const [supabase] = useState(() => createClient());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!dateISO) return;
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", dateISO)
      .order("appointment_time", { ascending: true });
    setAppointments((data as Appointment[]) ?? []);
    setLoading(false);
  }, [supabase, dateISO]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!dateISO) return;
    const channel = supabase
      .channel(`appointments-${dateISO}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `appointment_date=eq.${dateISO}`,
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, dateISO, refetch]);

  return { appointments, loading, refetch };
}

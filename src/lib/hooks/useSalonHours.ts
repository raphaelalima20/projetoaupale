"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_START_HOUR, BUSINESS_END_HOUR } from "@/lib/schedule";

const DEFAULT_OPENING = `${String(BUSINESS_START_HOUR).padStart(2, "0")}:00:00`;
const DEFAULT_CLOSING = `${String(BUSINESS_END_HOUR).padStart(2, "0")}:00:00`;

/** The salon's configured opening/closing time, driving every hour-based schedule UI. */
export function useSalonHours() {
  const [supabase] = useState(() => createClient());
  const [openingTime, setOpeningTime] = useState(DEFAULT_OPENING);
  const [closingTime, setClosingTime] = useState(DEFAULT_CLOSING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("salon_public")
      .select("opening_time, closing_time")
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data) {
          setOpeningTime(data.opening_time ?? DEFAULT_OPENING);
          setClosingTime(data.closing_time ?? DEFAULT_CLOSING);
        }
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return { openingTime, closingTime, loading };
}

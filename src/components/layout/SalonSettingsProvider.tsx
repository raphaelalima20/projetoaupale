"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SalonPublicSettings } from "@/lib/types/database";

export const DEFAULT_SALON_NAME = "AUPALE";
export const DEFAULT_SALON_SUBTITLE = "Salão de Beleza";

interface SalonSettingsContextValue {
  logoUrl: string | null;
  name: string;
  subtitle: string;
  phone: string | null;
  openingTime: string | null;
  closingTime: string | null;
  loading: boolean;
}

const INITIAL_VALUE: SalonSettingsContextValue = {
  logoUrl: null,
  name: DEFAULT_SALON_NAME,
  subtitle: DEFAULT_SALON_SUBTITLE,
  phone: null,
  openingTime: null,
  closingTime: null,
  loading: true,
};

const SalonSettingsContext = createContext<SalonSettingsContextValue>(INITIAL_VALUE);

/**
 * Branding and public salon info, fetched once per session from the `salon_public` view —
 * which is safe for anonymous visitors (it never exposes payment tokens or WhatsApp config).
 */
export function useSalonSettings() {
  return useContext(SalonSettingsContext);
}

export default function SalonSettingsProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [value, setValue] = useState<SalonSettingsContextValue>(INITIAL_VALUE);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("salon_public")
      .select("name, subtitle, phone, logo_url, opening_time, closing_time")
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const row = data as Pick<
          SalonPublicSettings,
          "name" | "subtitle" | "phone" | "logo_url" | "opening_time" | "closing_time"
        > | null;
        setValue({
          logoUrl: row?.logo_url ?? null,
          name: row?.name?.trim() || DEFAULT_SALON_NAME,
          subtitle: row?.subtitle?.trim() || DEFAULT_SALON_SUBTITLE,
          phone: row?.phone ?? null,
          openingTime: row?.opening_time ?? null,
          closingTime: row?.closing_time ?? null,
          loading: false,
        });
      });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return <SalonSettingsContext.Provider value={value}>{children}</SalonSettingsContext.Provider>;
}

"use client";

import { useEffect, useState } from "react";
import { Ribbon } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { megaTipoLabel } from "@/lib/mega";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { MegaEspecificacao } from "@/lib/types/database";

interface MegaHistoryRow extends MegaEspecificacao {
  appointments: { appointment_date: string } | null;
}

/** Histórico de Mega Hair da cliente — pra admin acompanhar técnica/combinação usadas ao longo do tempo. */
export default function ClientMegaHistory({ clientId }: { clientId: string }) {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<MegaHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("mega_especificacoes")
      .select("*, appointments!inner(client_id, appointment_date)")
      .eq("appointments.client_id", clientId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (active) {
          setRows((data as unknown as MegaHistoryRow[]) ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [clientId, supabase]);

  if (loading) return <Skeleton className="h-16 w-full" />;
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-btn border border-border p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-text">
        <Ribbon size={15} className="text-gold" />
        Histórico de Mega Hair
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-btn bg-surface2 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text">
                {r.appointments?.appointment_date ? formatDate(new Date(`${r.appointments.appointment_date}T12:00:00`)) : "—"}
                {" · "}
                {megaTipoLabel(r.tipo)}
              </span>
              <span className="font-medium text-gold-light">{formatCurrency(r.valor_tecnica + r.valor_cabelo)}</span>
            </div>
            <p className="mt-0.5 text-textDim">{r.combinacao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

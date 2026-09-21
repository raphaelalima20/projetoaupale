"use client";

import { useState } from "react";
import { ChevronDown, Phone, CalendarClock } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import { createClient } from "@/lib/supabase/client";
import { PACKAGE_STATUS_LABELS, packageStatusTone, packageSessionsRemaining } from "@/lib/packages";
import { formatCurrency, formatDate, formatPhone } from "@/lib/utils";
import { formatTimeLabel, parseISODate } from "@/lib/schedule";
import type { Appointment, ClientPackage, Profile } from "@/lib/types/database";

interface PackageCardProps {
  pkg: ClientPackage;
  collaboratorsById: Map<string, Profile>;
}

export default function PackageCard({ pkg, collaboratorsById }: PackageCardProps) {
  const [supabase] = useState(() => createClient());
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Appointment[] | null>(null);

  const remaining = packageSessionsRemaining(pkg);
  const progressPct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0;

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && sessions === null) {
      setLoading(true);
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("package_id", pkg.id)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });
      setSessions((data as Appointment[]) ?? []);
      setLoading(false);
    }
  }

  return (
    <Card className="border-gold/30">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{pkg.client_name}</p>
          <p className="flex items-center gap-1.5 text-xs text-textDim">
            <Phone size={11} />
            {formatPhone(pkg.client_phone)}
          </p>
        </div>
        <Badge tone={packageStatusTone(pkg.status)}>
          {PACKAGE_STATUS_LABELS[pkg.status] ?? pkg.status}
        </Badge>
      </div>

      <p className="font-display text-base text-gold-light">{pkg.package_name}</p>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-textDim">
          <span>
            {pkg.used_sessions} de {pkg.total_sessions} sessões usadas
          </span>
          <span>{remaining} restantes</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-textDim">
        <span>
          Total pago: <span className="text-text">{formatCurrency(pkg.total_price)}</span>
        </span>
        <span>
          Sessão: <span className="text-text">{formatCurrency(pkg.session_value)}</span>
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-textDim">
        <span>Comprado em {formatDate(new Date(pkg.purchased_at))}</span>
        {pkg.expires_at && <span>Expira em {formatDate(new Date(pkg.expires_at))}</span>}
      </div>

      <button
        type="button"
        onClick={toggleExpand}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-btn border border-border py-2 text-xs text-textDim transition duration-200 hover:border-gold/50 hover:text-text"
      >
        <ChevronDown size={14} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
        {expanded ? "Ocultar sessões" : "Ver histórico de sessões"}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          {loading ? (
            <p className="text-xs text-textDim">Carregando...</p>
          ) : !sessions || sessions.length === 0 ? (
            <p className="text-xs text-textDim">Nenhuma sessão registrada ainda</p>
          ) : (
            sessions.map((s) => {
              const collaborator = s.collaborator_id ? collaboratorsById.get(s.collaborator_id) : null;
              return (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <CalendarClock size={13} className="shrink-0 text-textDim" />
                  <span className="text-textDim">
                    {formatDate(parseISODate(s.appointment_date))} às{" "}
                    {formatTimeLabel(s.appointment_time)}
                  </span>
                  {collaborator && (
                    <div className="flex items-center gap-1">
                      <CollaboratorAvatar
                        name={collaborator.full_name}
                        color={collaborator.avatar_color}
                        photoUrl={collaborator.photo_url}
                        size={16}
                      />
                      <span className="text-textDim">{collaborator.full_name}</span>
                    </div>
                  )}
                  <Badge tone={s.status === "concluido" ? "success" : "neutral"} className="ml-auto">
                    {s.status === "concluido" ? "Concluída" : s.status === "cancelado" ? "Cancelada" : "Agendada"}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, Receipt } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import PaymentHistoryItem from "@/components/payments/PaymentHistoryItem";
import PaymentDetailModal from "@/components/payments/PaymentDetailModal";
import { createClient } from "@/lib/supabase/client";
import { useCollaborators } from "@/lib/hooks/useCollaborators";
import { generateCommissionPaymentsReportPdf } from "@/lib/pdf";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import { getMonday, addDays, toISODate, parseISODate } from "@/lib/schedule";
import type { CommissionPayment } from "@/lib/types/database";

type PeriodPreset = "hoje" | "semana" | "mes" | "tres_meses" | "personalizado";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
  { value: "tres_meses", label: "Últimos 3 meses" },
  { value: "personalizado", label: "Personalizado" },
];

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  tres_meses: "Últimos 3 meses",
  personalizado: "Período personalizado",
};

function getPeriodRange(preset: PeriodPreset, customStart: string, customEnd: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === "hoje") return { start: today, end: today };
  if (preset === "semana") {
    const monday = getMonday(today);
    return { start: monday, end: addDays(monday, 5) };
  }
  if (preset === "mes") {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }
  if (preset === "tres_meses") {
    return { start: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()), end: today };
  }
  if (customStart && customEnd) {
    return { start: parseISODate(customStart), end: parseISODate(customEnd) };
  }
  return { start: today, end: today };
}

export default function RelatoriosPagamentosPage() {
  const [supabase] = useState(() => createClient());
  const { collaborators } = useCollaborators();
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [customStart, setCustomStart] = useState(toISODate(new Date()));
  const [customEnd, setCustomEnd] = useState(toISODate(new Date()));
  const [collaboratorFilter, setCollaboratorFilter] = useState<string>("all");
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailPayment, setDetailPayment] = useState<CommissionPayment | null>(null);

  async function fetchPayments() {
    setLoading(true);
    const { start, end } = getPeriodRange(preset, customStart, customEnd);
    const startISO = toISODate(start);
    const endExclusiveISO = toISODate(addDays(end, 1));

    let query = supabase
      .from("commission_payments")
      .select("*")
      .gte("paid_at", startISO)
      .lt("paid_at", endExclusiveISO)
      .order("paid_at", { ascending: false });

    if (collaboratorFilter !== "all") {
      query = query.eq("collaborator_id", collaboratorFilter);
    }

    const { data } = await query;
    setPayments((data as CommissionPayment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, collaboratorFilter]);

  function collaboratorFor(id: string) {
    return collaborators.find((c) => c.id === id);
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.total_amount, 0);

  function handleExport() {
    const collaboratorLabel =
      collaboratorFilter === "all"
        ? "Todas"
        : (collaboratorFor(collaboratorFilter)?.full_name ?? "Todas");

    generateCommissionPaymentsReportPdf({
      periodLabel: PERIOD_LABELS[preset],
      collaboratorLabel,
      totalAmount,
      totalVale: payments.reduce((sum, p) => sum + (p.vale_amount || 0), 0),
      rows: payments.map((p) => ({
        date: formatDate(new Date(p.paid_at)),
        collaboratorName: p.collaborator_name,
        servicesCount: p.services_count,
        originalAmount: p.original_amount ?? p.total_amount,
        valeAmount: p.vale_amount || 0,
        amount: p.total_amount,
        paymentMethodLabel:
          PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ?? p.payment_method,
      })),
      generatedAt: new Date(),
    });
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Relatório de Pagamentos"
        subtitle="Histórico de pagamentos de comissões"
        actions={
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={loading || payments.length === 0}
          >
            <Download size={16} />
            Exportar
          </Button>
        }
      />

      <Card className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                "rounded-badge border px-3.5 py-1.5 text-xs font-medium transition duration-200",
                preset === p.value
                  ? "border-gold bg-gold-dim text-gold-light"
                  : "border-border text-textDim hover:border-gold/40 hover:text-text"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Colaboradora"
            value={collaboratorFilter}
            onChange={(e) => setCollaboratorFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </Select>

          {preset === "personalizado" && (
            <>
              <Input
                label="De"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <Input
                label="Até"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
              <Button onClick={fetchPayments}>Filtrar</Button>
            </>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : payments.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Receipt size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Nenhum pagamento neste período</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((p) => (
            <PaymentHistoryItem
              key={p.id}
              payment={p}
              collaborator={collaboratorFor(p.collaborator_id)}
              onClick={() => setDetailPayment(p)}
            />
          ))}
        </div>
      )}

      <PaymentDetailModal
        open={!!detailPayment}
        onClose={() => setDetailPayment(null)}
        payment={detailPayment}
        collaborator={detailPayment ? collaboratorFor(detailPayment.collaborator_id) : undefined}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, FileText, ArrowUpCircle, ArrowDownCircle, Wallet, CalendarCheck } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import PeriodFilter, { type PeriodPreset } from "@/components/cash/PeriodFilter";
import ReportCard from "@/components/cash/ReportCard";
import PaymentBreakdownGrid from "@/components/cash/PaymentBreakdownGrid";
import CashRegisterListItem from "@/components/cash/CashRegisterListItem";
import ReceivablesSection from "@/components/receivables/ReceivablesSection";
import { createClient } from "@/lib/supabase/client";
import { computePaymentTotals } from "@/lib/cash";
import { generateAccountingReportPdf } from "@/lib/pdf";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { getMonday, toISODate, parseISODate, addDays } from "@/lib/schedule";
import type { CashRegister, CashTransaction } from "@/lib/types/database";

function getPeriodRange(preset: PeriodPreset, customStart: string, customEnd: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === "hoje") return { start: today, end: today };
  if (preset === "ontem") {
    const yesterday = addDays(today, -1);
    return { start: yesterday, end: yesterday };
  }
  if (preset === "semana") {
    const monday = getMonday(today);
    return { start: monday, end: addDays(monday, 5) };
  }
  if (preset === "mes") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: first, end: today };
  }
  if (customStart && customEnd) {
    return { start: parseISODate(customStart), end: parseISODate(customEnd) };
  }
  return { start: today, end: today };
}

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Esta semana",
  mes: "Este mês",
  personalizado: "Período personalizado",
};

export default function RelatoriosCaixaPage() {
  const [supabase] = useState(() => createClient());
  const [preset, setPreset] = useState<PeriodPreset>("semana");
  const [customStart, setCustomStart] = useState(toISODate(new Date()));
  const [customEnd, setCustomEnd] = useState(toISODate(new Date()));
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [commissionsPaid, setCommissionsPaid] = useState(0);
  const [promissoriaTotals, setPromissoriaTotals] = useState({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  async function fetchReport() {
    setLoading(true);
    const { start, end } = getPeriodRange(preset, customStart, customEnd);
    const startISO = toISODate(start);
    const endExclusiveISO = toISODate(addDays(end, 1));

    const { data: registerData } = await supabase
      .from("cash_register")
      .select("*")
      .gte("opened_at", startISO)
      .lt("opened_at", endExclusiveISO)
      .order("opened_at", { ascending: true });

    const regs = (registerData as CashRegister[]) ?? [];
    setRegisters(regs);

    const ids = regs.map((r) => r.id);
    if (ids.length > 0) {
      const { data: txData } = await supabase
        .from("cash_transactions")
        .select("*")
        .in("cash_register_id", ids);
      setTransactions((txData as CashTransaction[]) ?? []);
    } else {
      setTransactions([]);
    }

    const { data: paymentsData } = await supabase
      .from("commission_payments")
      .select("total_amount")
      .gte("paid_at", startISO)
      .lt("paid_at", endExclusiveISO);
    setCommissionsPaid(
      ((paymentsData as { total_amount: number }[]) ?? []).reduce(
        (sum, p) => sum + p.total_amount,
        0
      )
    );

    const { data: receivablesData } = await supabase
      .from("receivables")
      .select("original_amount")
      .gte("created_at", startISO)
      .lt("created_at", endExclusiveISO);
    const receivablesList = (receivablesData as { original_amount: number }[]) ?? [];
    setPromissoriaTotals({
      total: receivablesList.reduce((sum, r) => sum + r.original_amount, 0),
      count: receivablesList.length,
    });

    setLoading(false);
  }

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const totalEntries = transactions.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
  const totalExits = transactions.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
  const netResult = totalEntries - totalExits;
  const paymentTotals = computePaymentTotals(transactions);

  function transactionsFor(registerId: string) {
    return transactions.filter((t) => t.cash_register_id === registerId);
  }

  function handleExportPdf() {
    generateAccountingReportPdf({
      periodLabel: PERIOD_LABELS[preset],
      totalEntries,
      totalExits,
      totalCommissionsPaid: commissionsPaid,
      netResult,
      paymentTotals,
      days: registers.map((r) => {
        const regTx = transactionsFor(r.id);
        const entries = regTx.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
        const exits = regTx.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
        return {
          date: formatDate(new Date(r.opened_at)),
          openedAt: formatTime(r.opened_at),
          closedAt: r.closed_at ? formatTime(r.closed_at) : null,
          entries,
          exits,
          total: entries - exits,
        };
      }),
      generatedAt: new Date(),
    });
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Relatórios de Caixa"
        subtitle="Acompanhe o histórico financeiro"
        actions={
          <Button variant="secondary" onClick={handleExportPdf} disabled={loading || registers.length === 0}>
            <Download size={16} />
            Exportar PDF
          </Button>
        }
      />

      <Card className="mb-6">
        <PeriodFilter
          preset={preset}
          customStart={customStart}
          customEnd={customEnd}
          onChangePreset={setPreset}
          onChangeCustomStart={setCustomStart}
          onChangeCustomEnd={setCustomEnd}
          onApply={fetchReport}
        />
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              label="Total de entradas"
              value={formatCurrency(totalEntries)}
              icon={ArrowUpCircle}
              valueClassName="text-success"
            />
            <ReportCard
              label="Total de saídas"
              value={formatCurrency(totalExits)}
              icon={ArrowDownCircle}
              valueClassName="text-danger"
            />
            <ReportCard label="Resultado líquido" value={formatCurrency(netResult)} icon={Wallet} />
            <ReportCard
              label="Dias com caixa aberto"
              value={String(registers.length)}
              icon={CalendarCheck}
            />
          </div>

          <div className="mb-6">
            <h2 className="mb-3 font-display text-lg text-text">Por forma de pagamento</h2>
            <PaymentBreakdownGrid totals={paymentTotals} promissoriaOverride={promissoriaTotals} />
          </div>

          <div className="mb-6">
            <h2 className="mb-3 font-display text-lg text-text">Caixas do período</h2>
            {registers.length === 0 ? (
              <Card className="py-10 text-center text-sm text-textDim">
                Nenhum caixa neste período
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {registers.map((r) => (
                  <CashRegisterListItem key={r.id} register={r} transactions={transactionsFor(r.id)} />
                ))}
              </div>
            )}
          </div>

          <Card>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-dim">
                  <FileText size={20} className="text-gold" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">Relatório Contábil</p>
                  <p className="text-xs text-textDim">Documento completo para o contador</p>
                </div>
              </div>
              <Button onClick={handleExportPdf} disabled={registers.length === 0}>
                <FileText size={16} />
                Gerar Relatório Contábil
              </Button>
            </div>
          </Card>

          <ReceivablesSection />
        </>
      )}
    </div>
  );
}

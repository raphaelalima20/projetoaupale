"use client";

import { useState } from "react";
import { Wallet, Lock, Unlock, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import CashRegisterStatus from "@/components/cash/CashRegisterStatus";
import PaymentBreakdownGrid from "@/components/cash/PaymentBreakdownGrid";
import CashTransactionItem from "@/components/cash/CashTransactionItem";
import ManualTransactionModal from "@/components/cash/ManualTransactionModal";
import CashClosingModal from "@/components/cash/CashClosingModal";
import { useOpenCashRegister } from "@/lib/hooks/useCashRegister";
import { useCashTransactions } from "@/lib/hooks/useCashTransactions";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { computeCashSummary } from "@/lib/cash";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TransactionType } from "@/lib/types/database";

export default function CaixaPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const { register, lastClosed, loading: loadingRegister, refetch: refetchRegister } =
    useOpenCashRegister();
  const { transactions, loading: loadingTransactions, refetch: refetchTransactions } =
    useCashTransactions(register?.id ?? null);

  const [openingAmount, setOpeningAmount] = useState("");
  const [openingLoading, setOpeningLoading] = useState(false);
  const [manualType, setManualType] = useState<TransactionType | null>(null);
  const [closingOpen, setClosingOpen] = useState(false);
  const [closingLoading, setClosingLoading] = useState(false);

  async function handleOpenCash() {
    if (!user) return;
    const amount = Number(openingAmount) || 0;
    setOpeningLoading(true);
    const { error } = await supabase.from("cash_register").insert({
      status: "aberto",
      opening_amount: amount,
      opened_by: user.id,
    });
    setOpeningLoading(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Caixa aberto");
    setOpeningAmount("");
    refetchRegister();
  }

  const summary = register ? computeCashSummary(transactions, register.opening_amount) : null;

  async function handleCloseCash(notes: string) {
    if (!register || !summary || !user) return;
    setClosingLoading(true);
    const { error } = await supabase
      .from("cash_register")
      .update({
        status: "fechado",
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        total_pix: summary.paymentTotals.pix.total,
        total_dinheiro: summary.paymentTotals.dinheiro.total,
        total_credito: summary.paymentTotals.credito.total,
        total_debito: summary.paymentTotals.debito.total,
        total_entries: summary.totalEntries,
        total_exits: summary.totalExits,
        total_day: summary.totalDay,
        notes: notes || null,
      })
      .eq("id", register.id);
    setClosingLoading(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Caixa fechado com sucesso");
    setClosingOpen(false);
    refetchRegister();
  }

  if (loadingRegister) {
    return (
      <div className="animate-fadeIn">
        <PageHeader title="Fluxo de Caixa" subtitle="Controle as entradas e saídas do caixa" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!register) {
    return (
      <div className="animate-fadeIn">
        <PageHeader title="Fluxo de Caixa" subtitle="Controle as entradas e saídas do caixa" />
        <Card className="mx-auto flex max-w-sm flex-col items-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-dim">
            <Wallet size={30} className="text-gold" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-display text-xl text-text">Caixa Fechado</h2>
            <p className="mt-1 text-sm text-textDim">
              {lastClosed
                ? `Último fechamento: ${formatDate(new Date(lastClosed.closed_at as string))} — ${formatCurrency(
                    lastClosed.total_day
                  )}`
                : "Abra o caixa para começar a registrar movimentações"}
            </p>
          </div>
          <div className="w-full">
            <Input
              label="Valor de abertura (troco)"
              type="number"
              step="0.01"
              min="0"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <Button onClick={handleOpenCash} loading={openingLoading} className="w-full">
            <Unlock size={16} />
            Abrir Caixa
          </Button>
        </Card>
      </div>
    );
  }

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Controle as entradas e saídas do caixa"
        actions={
          <div className="flex items-center gap-3">
            <CashRegisterStatus status="aberto" time={register.opened_at} />
            <Button variant="danger" onClick={() => setClosingOpen(true)}>
              <Lock size={16} />
              Fechar Caixa
            </Button>
          </div>
        }
      />

      <Card className="mb-6 bg-gradient-to-br from-gold-dim to-surface">
        <p className="text-xs uppercase tracking-wider text-gold-light">
          Total do dia — {formatDate(new Date())}
        </p>
        <p className="mt-2 font-display text-3xl text-text">
          {summary ? formatCurrency(summary.totalDay) : "—"}
        </p>
        <p className="mt-1 text-sm text-textDim">
          Abertura: {formatCurrency(register.opening_amount)}
        </p>
      </Card>

      {summary && <PaymentBreakdownGrid totals={summary.paymentTotals} exclude={["promissoria"]} />}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button onClick={() => setManualType("entrada")} className="w-full">
          <ArrowUpCircle size={16} />
          Entrada
        </Button>
        <Button variant="danger" onClick={() => setManualType("saida")} className="w-full">
          <ArrowDownCircle size={16} />
          Saída
        </Button>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg text-text">Movimentações do dia</h2>
        {loadingTransactions ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : sortedTransactions.length === 0 ? (
          <Card className="py-10 text-center text-sm text-textDim">Nenhuma movimentação ainda</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedTransactions.map((t) => (
              <CashTransactionItem key={t.id} transaction={t} />
            ))}
          </div>
        )}
      </div>

      {manualType && (
        <ManualTransactionModal
          open={!!manualType}
          onClose={() => setManualType(null)}
          onCreated={refetchTransactions}
          type={manualType}
          cashRegisterId={register.id}
          currentUserId={user?.id ?? ""}
        />
      )}

      {summary && (
        <CashClosingModal
          open={closingOpen}
          onClose={() => setClosingOpen(false)}
          onConfirm={handleCloseCash}
          loading={closingLoading}
          openingAmount={register.opening_amount}
          totalEntries={summary.totalEntries}
          totalExits={summary.totalExits}
          totalDay={summary.totalDay}
          expectedCashBalance={summary.expectedCashBalance}
          paymentTotals={summary.paymentTotals}
        />
      )}
    </div>
  );
}

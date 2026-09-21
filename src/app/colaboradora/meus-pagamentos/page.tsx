"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import PaymentHistoryItem from "@/components/payments/PaymentHistoryItem";
import PaymentDetailModal from "@/components/payments/PaymentDetailModal";
import { useCommissionPayments } from "@/lib/hooks/useCommissionPayments";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CommissionPayment } from "@/lib/types/database";

export default function MeusPagamentosPage() {
  const { profile } = useAuth();
  const { payments, loading } = useCommissionPayments(profile?.id);
  const [detailPayment, setDetailPayment] = useState<CommissionPayment | null>(null);

  const totalReceived = payments.reduce((sum, p) => sum + p.total_amount, 0);
  const lastPayment = payments[0] ?? null;

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Meus Pagamentos" subtitle="Histórico de pagamentos recebidos" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-textDim">Total recebido</p>
          <p className="mt-1 font-display text-2xl text-gold-light">
            {loading ? "—" : formatCurrency(totalReceived)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-textDim">Último pagamento</p>
          <p className="mt-1 font-display text-2xl text-text">
            {loading ? "—" : lastPayment ? formatDate(new Date(lastPayment.paid_at)) : "—"}
          </p>
        </Card>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : payments.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Receipt size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Nenhum pagamento recebido ainda</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {payments.map((p) => (
            <PaymentHistoryItem
              key={p.id}
              payment={p}
              onClick={() => setDetailPayment(p)}
              showCashBadge={false}
            />
          ))}
        </div>
      )}

      <PaymentDetailModal
        open={!!detailPayment}
        onClose={() => setDetailPayment(null)}
        payment={detailPayment}
        showAdminFields={false}
      />
    </div>
  );
}

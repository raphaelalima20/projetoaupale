"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, FileText, Phone } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import ReceiveModal from "./ReceiveModal";
import { createClient } from "@/lib/supabase/client";
import { RECEIVABLE_STATUS_LABELS, receivableStatusTone } from "@/lib/receivables";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency, formatDate, formatPhone } from "@/lib/utils";
import type { Receivable, ReceivablePayment } from "@/lib/types/database";

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

export interface ReceivableGroup {
  key: string;
  clientName: string;
  clientPhone: string | null;
  items: Receivable[];
  total: number;
}

export default function ReceivablesSection() {
  const [supabase] = useState(() => createClient());
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [paymentsByReceivable, setPaymentsByReceivable] = useState<Map<string, ReceivablePayment[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<ReceivableGroup | null>(null);

  async function fetchReceivables() {
    setLoading(true);
    const { data } = await supabase
      .from("receivables")
      .select("*")
      .neq("status", "pago")
      .order("created_at", { ascending: true });
    const list = (data as Receivable[]) ?? [];
    setReceivables(list);

    const ids = list.filter((r) => r.status === "parcial").map((r) => r.id);
    if (ids.length > 0) {
      const { data: paymentsData } = await supabase
        .from("receivable_payments")
        .select("*")
        .in("receivable_id", ids)
        .order("created_at", { ascending: true });
      const map = new Map<string, ReceivablePayment[]>();
      for (const p of (paymentsData as ReceivablePayment[]) ?? []) {
        const existing = map.get(p.receivable_id);
        if (existing) existing.push(p);
        else map.set(p.receivable_id, [p]);
      }
      setPaymentsByReceivable(map);
    } else {
      setPaymentsByReceivable(new Map());
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchReceivables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo<ReceivableGroup[]>(() => {
    const map = new Map<string, ReceivableGroup>();
    for (const r of receivables) {
      const key = r.client_phone ?? r.client_name;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(r);
        existing.total += r.remaining_amount;
      } else {
        map.set(key, {
          key,
          clientName: r.client_name,
          clientPhone: r.client_phone,
          items: [r],
          total: r.remaining_amount,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [receivables]);

  const totalReceivable = groups.reduce((sum, g) => sum + g.total, 0);

  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-text">
        <FileText size={18} className="text-gold" />A Receber
      </h2>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warn/15">
            <FileText size={20} className="text-warn" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-textDim">Total a Receber</p>
            <p className="mt-1 font-display text-xl text-text">
              {loading ? "—" : formatCurrency(totalReceivable)}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-dim">
            <Phone size={20} className="text-gold" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-textDim">Clientes com pendência</p>
            <p className="mt-1 font-display text-xl text-text">{loading ? "—" : groups.length}</p>
          </div>
        </Card>
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : groups.length === 0 ? (
        <Card className="py-10 text-center text-sm text-textDim">
          Nenhuma pendência de recebimento
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <Card key={group.key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{group.clientName}</p>
                  {group.clientPhone && (
                    <p className="text-xs text-textDim">{formatPhone(group.clientPhone)}</p>
                  )}
                </div>
                <p className="shrink-0 font-display text-lg text-warn">
                  {formatCurrency(group.total)}
                </p>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-3">
                {group.items.map((item) => {
                  const paid = Math.round((item.original_amount - item.remaining_amount) * 100) / 100;
                  const payments = paymentsByReceivable.get(item.id) ?? [];
                  return (
                    <div key={item.id} className="flex flex-col gap-1.5 text-xs">
                      <span className="text-textDim">
                        {item.service_name ?? "Atendimento"} · {formatDate(new Date(item.created_at))}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-textDim">
                          Valor original:{" "}
                          <span className="text-text">{formatCurrency(item.original_amount)}</span>
                        </span>
                        {paid > 0 && (
                          <span className="text-textDim">
                            Pago: <span className="text-success">{formatCurrency(paid)}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-textDim">
                          Restante:{" "}
                          <span className="font-medium text-gold-light">
                            {formatCurrency(item.remaining_amount)}
                          </span>
                          <Badge tone={receivableStatusTone(item.status)}>
                            {RECEIVABLE_STATUS_LABELS[item.status] ?? item.status}
                          </Badge>
                        </span>
                      </div>
                      {payments.length > 0 && (
                        <div className="mt-0.5 flex flex-col gap-1 border-t border-border/50 pt-1.5">
                          {payments.map((p) => (
                            <p key={p.id} className="text-[11px] text-textDim">
                              {formatDate(new Date(p.created_at))} — Recebido{" "}
                              <span className="text-success">{formatCurrency(p.amount)}</span> via{" "}
                              {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button size="sm" onClick={() => setSelectedGroup(group)} className="self-end">
                <DollarSign size={14} />
                Receber
              </Button>
            </Card>
          ))}
        </div>
      )}

      <ReceiveModal
        open={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        onReceived={fetchReceivables}
        group={selectedGroup}
      />
    </div>
  );
}

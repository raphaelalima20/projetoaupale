"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, PackageOpen, Phone } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOpenCashRegister } from "@/lib/hooks/useCashRegister";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatPhone, cn } from "@/lib/utils";
import type { CartOrder } from "@/lib/types/database";

interface OrderItemRow {
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  kind?: "produto" | "pacote";
}

const STATUS_TONE: Record<string, "gold" | "success" | "danger"> = {
  pendente: "gold",
  pago: "success",
  cancelado: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

const FILTERS = [
  { value: "pendente", label: "Pendentes" },
  { value: "pago", label: "Pagos" },
  { value: "cancelado", label: "Cancelados" },
  { value: "all", label: "Todos" },
];

export default function OrderManagement({
  orders,
  onChanged,
}: {
  orders: CartOrder[];
  onChanged: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile } = useAuth();
  const { register: cashRegister } = useOpenCashRegister();
  const [filter, setFilter] = useState("pendente");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  async function handleConfirmPayment(order: CartOrder) {
    setProcessingId(order.id);
    const items = (order.items as unknown as OrderItemRow[]) ?? [];

    for (const item of items) {
      if (item.kind === "pacote") continue;
      const { error: saleError } = await supabase.from("product_sales").insert({
        product_id: item.product_id ?? null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        payment_method: order.payment_method ?? "dinheiro",
        client_name: order.client_name,
        client_phone: order.client_phone,
        sold_by: profile?.id ?? null,
      });
      if (saleError) {
        showToast(saleError.message, "error");
        setProcessingId(null);
        return;
      }
    }

    if (cashRegister) {
      await supabase.from("cash_transactions").insert({
        cash_register_id: cashRegister.id,
        type: "entrada",
        amount: order.total,
        payment_method: order.payment_method ?? "dinheiro",
        description: `Pedido online: ${order.client_name ?? "Cliente"}`,
        category: "produto",
        affect_cash: true,
        created_by: profile?.id ?? null,
      });
    }

    const { error: statusError } = await supabase
      .from("cart_orders")
      .update({ status: "pago" })
      .eq("id", order.id);

    setProcessingId(null);
    if (statusError) {
      showToast(statusError.message, "error");
      return;
    }
    showToast("Pagamento confirmado");
    onChanged();
  }

  async function handleCancel(order: CartOrder) {
    setProcessingId(order.id);
    const { error } = await supabase.from("cart_orders").update({ status: "cancelado" }).eq("id", order.id);
    setProcessingId(null);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Pedido cancelado");
    onChanged();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-badge border px-3.5 py-1.5 text-xs font-medium transition duration-200",
              filter === f.value
                ? "border-gold bg-gold-dim text-gold-light"
                : "border-border text-textDim hover:border-gold/40 hover:text-text"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <PackageOpen size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Nenhum pedido por aqui</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((order) => {
            const items = (order.items as unknown as OrderItemRow[]) ?? [];
            const method = PAYMENT_METHODS.find((m) => m.value === order.payment_method);
            return (
              <Card key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text">{order.client_name ?? "Cliente"}</p>
                      <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-textDim">{formatDateTime(order.created_at)}</p>
                    {order.client_phone && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-textDim">
                        <Phone size={12} />
                        {formatPhone(order.client_phone)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-gold-light">{formatCurrency(order.total)}</p>
                    <p className="text-xs text-textDim">{method?.label ?? order.payment_method}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-xs text-textDim">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span>
                        {item.quantity}x {item.product_name}
                      </span>
                      <span>{formatCurrency(item.total_price)}</span>
                    </div>
                  ))}
                </div>

                {order.status === "pendente" && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleConfirmPayment(order)}
                      loading={processingId === order.id}
                      className="flex-1"
                    >
                      <CheckCircle2 size={14} />
                      Confirmar Pagamento
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleCancel(order)}
                      disabled={processingId === order.id}
                      className="flex-1"
                    >
                      <XCircle size={14} />
                      Cancelar
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

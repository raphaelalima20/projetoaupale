"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PhoneInput from "@/components/ui/PhoneInput";
import Button from "@/components/ui/Button";
import PaymentMethodSelect from "@/components/appointments/PaymentMethodSelect";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOpenCashRegister } from "@/lib/hooks/useCashRegister";
import { formatCurrency } from "@/lib/utils";
import type { PaymentMethod, Product } from "@/lib/types/database";

interface QuickSaleModalProps {
  open: boolean;
  onClose: () => void;
  onSold: () => void;
  product: Product | null;
}

export default function QuickSaleModal({ open, onClose, onSold, product }: QuickSaleModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile } = useAuth();
  const { register: cashRegister } = useOpenCashRegister();

  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setUnitPrice(String(product.promotional_price ?? product.price));
    setQuantity("1");
    setPaymentMethod(null);
    setClientName("");
    setClientPhone("");
    setError("");
  }, [open, product]);

  if (!product) return null;

  const priceNumber = Number(unitPrice) || 0;
  const qtyNumber = Number(quantity) || 0;
  const total = priceNumber * qtyNumber;
  const canConfirm = !!paymentMethod && priceNumber > 0 && qtyNumber > 0 && !!cashRegister;

  async function handleConfirm() {
    if (!product || !paymentMethod || !canConfirm) return;
    setError("");
    setLoading(true);

    const { error: saleError } = await supabase.from("product_sales").insert({
      product_id: product.id,
      product_name: product.name,
      quantity: qtyNumber,
      unit_price: priceNumber,
      total_price: total,
      payment_method: paymentMethod,
      client_name: clientName.trim() || null,
      client_phone: clientPhone || null,
      sold_by: profile?.id ?? null,
    });

    if (saleError) {
      setError(saleError.message);
      setLoading(false);
      return;
    }

    if (cashRegister) {
      const { error: txError } = await supabase.from("cash_transactions").insert({
        cash_register_id: cashRegister.id,
        type: "entrada",
        amount: total,
        payment_method: paymentMethod,
        description: `Venda: ${product.name}`,
        category: "produto",
        affect_cash: true,
        created_by: profile?.id ?? null,
      });
      if (txError) {
        setError(txError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    showToast("Venda registrada");
    onSold();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Vender Produto">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text">{product.name}</p>

        {!cashRegister && (
          <div className="flex items-center gap-2 rounded-btn border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            <AlertTriangle size={15} className="shrink-0" />
            Abra o caixa para registrar vendas.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Preço unitário (R$)"
            type="number"
            step="0.01"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <Input
            label="Quantidade"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between rounded-btn bg-surface2 p-3 text-sm">
          <span className="text-textDim">Total</span>
          <span className="font-display text-lg text-gold-light">{formatCurrency(total)}</span>
        </div>

        <div>
          <p className="mb-2 text-sm text-textDim">Forma de pagamento</p>
          <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
        </div>

        <Input
          label="Nome do cliente"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Opcional"
        />
        <PhoneInput
          label="Telefone do cliente"
          value={clientPhone}
          onChange={setClientPhone}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={handleConfirm} loading={loading} disabled={!canConfirm} className="w-full">
          <ShoppingCart size={16} />
          Registrar Venda
        </Button>
      </div>
    </Modal>
  );
}

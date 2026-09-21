"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PhoneInput from "@/components/ui/PhoneInput";
import PaymentMethodSelect from "@/components/appointments/PaymentMethodSelect";
import PixQRCode from "@/components/cart/PixQRCode";
import { useCart } from "@/components/cart/CartProvider";
import { createClient } from "@/lib/supabase/client";
import { buildPixPayload } from "@/lib/pix";
import { formatCurrency, cn } from "@/lib/utils";
import type { PaymentMethod, SalonPublicSettings } from "@/lib/types/database";

type Step = "cart" | "checkout" | "success";

export default function CarrinhoPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { items, updateQuantity, removeItem, totalAmount, clear } = useCart();

  const [step, setStep] = useState<Step>("cart");
  const [settings, setSettings] = useState<SalonPublicSettings | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("salon_public")
      .select("*")
      .maybeSingle()
      .then(({ data }) => setSettings(data as SalonPublicSettings | null));
  }, [supabase]);

  function handleGoToCheckout() {
    if (items.length === 0) return;
    setStep("checkout");
  }

  async function handleConfirm() {
    if (!clientName.trim() || clientPhone.length < 10) {
      setError("Informe seu nome e telefone.");
      return;
    }
    if (!paymentMethod) {
      setError("Selecione a forma de pagamento.");
      return;
    }
    setError("");
    setSubmitting(true);

    const { error: insertError } = await supabase.from("cart_orders").insert({
      client_name: clientName.trim(),
      client_phone: clientPhone,
      items: items.map((i) => ({
        product_id: i.refId,
        product_name: i.name,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        total_price: i.unitPrice * i.quantity,
        kind: i.kind,
      })),
      total: totalAmount,
      payment_method: paymentMethod,
      status: "pendente",
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    clear();
    setStep("success");
  }

  const pixPayload =
    paymentMethod === "pix" && settings?.pix_key
      ? buildPixPayload({
          key: settings.pix_key,
          merchantName: settings.pix_beneficiary || settings.name || "AUPALE",
          merchantCity: settings.city || "SAO PAULO",
          amount: totalAmount,
        })
      : null;

  if (step === "success") {
    return (
      <Card className="flex flex-col items-center gap-4 py-10 text-center animate-fadeIn">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 size={32} className="text-success" />
        </div>
        <div>
          <h1 className="font-display text-xl text-text">Pedido realizado!</h1>
          <p className="mt-1 text-sm text-textDim">
            Recebemos seu pedido, {clientName.split(" ")[0]}. Entraremos em contato em breve.
          </p>
        </div>
        <Button onClick={() => router.push("/cliente")} className="mt-2 w-full">
          Voltar ao início
        </Button>
      </Card>
    );
  }

  if (step === "checkout") {
    return (
      <div className="animate-fadeIn">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setStep("cart")}
            aria-label="Voltar"
            className="rounded-btn border border-border p-2 text-textDim transition duration-200 hover:border-gold hover:text-gold"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl text-text">Finalizar Pedido</h1>
        </div>

        <Card className="flex flex-col gap-4">
          <Input
            label="Nome completo"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
          />
          <PhoneInput value={clientPhone} onChange={setClientPhone} required />

          <div>
            <p className="mb-2 text-sm text-textDim">Forma de pagamento</p>
            <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
          </div>

          {paymentMethod === "pix" &&
            (pixPayload ? (
              <PixQRCode payload={pixPayload} amount={totalAmount} />
            ) : (
              <p className="rounded-btn border border-border bg-surface2 p-3 text-sm text-textDim">
                Pagamento Pix não disponível. Configure nas configurações do salão.
              </p>
            ))}

          {(paymentMethod === "credito" || paymentMethod === "debito") &&
            (settings?.mercado_pago_enabled && settings?.mercado_pago_link ? (
              <div className="flex flex-col gap-3 rounded-btn border border-border bg-surface2 p-4 text-sm text-textDim">
                <p>
                  Pague o valor de{" "}
                  <span className="font-medium text-text">{formatCurrency(totalAmount)}</span> com
                  cartão pelo Mercado Pago e, depois, toque em <em>Confirmar Pedido</em>.
                </p>
                <a
                  href={settings.mercado_pago_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-btn border border-primary px-4 py-2.5 text-sm font-medium text-text transition duration-200 hover:bg-primary/15"
                >
                  <ExternalLink size={16} />
                  Pagar com cartão (Mercado Pago)
                </a>
              </div>
            ) : (
              <p className="rounded-btn border border-border bg-surface2 p-3 text-sm text-textDim">
                Pagamento por cartão será realizado presencialmente no salão.
              </p>
            ))}

          {paymentMethod === "dinheiro" && (
            <p className="rounded-btn border border-border bg-surface2 p-3 text-sm text-textDim">
              Pagamento em dinheiro será realizado presencialmente no salão.
            </p>
          )}

          <div className="border-t border-border pt-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-textDim">Total</span>
              <span className="font-display text-2xl text-gold-light">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            {error && <p className="mb-3 text-sm text-danger">{error}</p>}
            <Button onClick={handleConfirm} loading={submitting} className="w-full">
              Confirmar Pedido
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/cliente/catalogo")}
          aria-label="Continuar comprando"
          className="rounded-btn border border-border p-2 text-textDim transition duration-200 hover:border-gold hover:text-gold"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-xl text-text">Carrinho</h1>
      </div>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <ShoppingCart size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Seu carrinho está vazio</p>
          <Button onClick={() => router.push("/cliente/catalogo")} className="mt-2">
            Ver catálogo
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <Card key={item.key} className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-surface2">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingCart size={20} className="text-textDim" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">{item.name}</p>
                  <p className="text-xs text-textDim">{formatCurrency(item.unitPrice)} / un.</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity - 1)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-btn border border-border text-textDim transition duration-200 hover:border-gold hover:text-gold"
                      )}
                      aria-label="Diminuir"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-6 text-center text-sm text-text">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      disabled={!!item.maxQuantity && item.quantity >= item.maxQuantity}
                      className="flex h-7 w-7 items-center justify-center rounded-btn border border-border text-textDim transition duration-200 hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Aumentar"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-sm font-medium text-gold-light">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                  <button
                    onClick={() => removeItem(item.key)}
                    aria-label="Remover"
                    className="text-textDim transition duration-200 hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-textDim">Subtotal</span>
              <span className="text-text">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-textDim">Total</span>
              <span className="font-display text-xl text-gold-light">{formatCurrency(totalAmount)}</span>
            </div>
          </Card>

          <Button onClick={handleGoToCheckout} className="mt-4 w-full">
            Continuar para pagamento
          </Button>
        </>
      )}
    </div>
  );
}

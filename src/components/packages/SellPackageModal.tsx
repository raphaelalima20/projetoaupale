"use client";

import { FormEvent, useEffect, useState } from "react";
import { Package, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PhoneInput from "@/components/ui/PhoneInput";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import PaymentMethodSelect from "@/components/appointments/PaymentMethodSelect";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useOpenCashRegister } from "@/lib/hooks/useCashRegister";
import { useAuth } from "@/components/auth/AuthProvider";
import { upsertClientByPhone } from "@/lib/packages";
import type { PaymentMethod, Service } from "@/lib/types/database";

interface SellPackageModalProps {
  open: boolean;
  onClose: () => void;
  onSold: () => void;
  packageServices: Service[];
}

export default function SellPackageModal({
  open,
  onClose,
  onSold,
  packageServices,
}: SellPackageModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile } = useAuth();
  const { register: cashRegister } = useOpenCashRegister();

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [sessionsCount, setSessionsCount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientName("");
    setPhone("");
    setServiceId("");
    setTotalPrice("");
    setSessionsCount("");
    setPaymentMethod(null);
    setError("");
  }, [open]);

  const selectedService = packageServices.find((s) => s.id === serviceId) ?? null;

  function handleSelectService(id: string) {
    setServiceId(id);
    const service = packageServices.find((s) => s.id === id);
    if (service) setTotalPrice(String(service.price));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!clientName.trim()) return setError("Informe o nome do cliente.");
    if (phone.length < 10) return setError("Informe um telefone válido.");
    if (!selectedService) return setError("Selecione um pacote.");
    const priceNumber = Number(totalPrice);
    if (!totalPrice || priceNumber <= 0) return setError("Informe o preço total do pacote.");
    const sessions = Number(sessionsCount);
    if (!sessionsCount || !Number.isInteger(sessions) || sessions <= 0) {
      return setError("Informe o número de sessões.");
    }
    if (!paymentMethod) return setError("Selecione a forma de pagamento.");
    if (!cashRegister) return setError("Abra o caixa antes de vender um pacote.");

    setLoading(true);

    const clientId = await upsertClientByPhone(supabase, clientName, phone);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data: pkg, error: pkgError } = await supabase
      .from("client_packages")
      .insert({
        client_id: clientId,
        client_name: clientName.trim(),
        client_phone: phone,
        package_service_id: selectedService.id,
        package_name: selectedService.name,
        package_description: selectedService.description,
        total_sessions: sessions,
        used_sessions: 0,
        total_price: priceNumber,
        session_value: 0,
        payment_method: paymentMethod,
        status: "ativo",
        expires_at: expiresAt.toISOString(),
        created_by: profile?.id ?? null,
      })
      .select()
      .single();

    if (pkgError || !pkg) {
      setError(pkgError?.message ?? "Não foi possível registrar a venda.");
      setLoading(false);
      return;
    }

    const { data: tx, error: txError } = await supabase
      .from("cash_transactions")
      .insert({
        cash_register_id: cashRegister.id,
        type: "entrada",
        amount: priceNumber,
        payment_method: paymentMethod,
        description: `Pacote: ${selectedService.name} — ${clientName.trim()}`,
        category: "pacote",
        affect_cash: true,
        created_by: profile?.id ?? null,
      })
      .select()
      .single();

    if (!txError && tx) {
      await supabase.from("client_packages").update({ cash_transaction_id: tx.id }).eq("id", pkg.id);
    }

    setLoading(false);
    showToast("Pacote vendido com sucesso");
    onSold();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Vender Pacote">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Cliente"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Nome completo"
          required
          autoFocus
        />
        <PhoneInput value={phone} onChange={setPhone} required />

        <Select
          label="Pacote"
          value={serviceId}
          onChange={(e) => handleSelectService(e.target.value)}
          required
        >
          <option value="" disabled>
            Selecione um pacote
          </option>
          {packageServices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        {selectedService && (
          <>
            <Input
              label="Preço total (R$)"
              type="number"
              min="0"
              step="0.01"
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              required
            />

            <Input
              label="Número de sessões"
              type="number"
              min="1"
              step="1"
              value={sessionsCount}
              onChange={(e) => setSessionsCount(e.target.value)}
              required
            />

            <div>
              <p className="mb-2 text-sm text-textDim">Forma de pagamento</p>
              <PaymentMethodSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                exclude={["promissoria"]}
              />
            </div>
          </>
        )}

        {!cashRegister && (
          <div className="flex items-center gap-2 rounded-btn border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle size={15} className="shrink-0" />
            Abra o caixa antes de vender um pacote.
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} disabled={!cashRegister} className="mt-2 w-full">
          <Package size={16} />
          Registrar Venda
        </Button>
      </form>
    </Modal>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { Scissors, Package, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { SERVICE_PACKAGE_PERIODS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Service, ServiceType } from "@/lib/types/database";

interface ServiceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  service: Service | null;
}

export default function ServiceFormModal({ open, onClose, onSaved, service }: ServiceFormModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();

  const [typeChoice, setTypeChoice] = useState<ServiceType | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [isVariablePrice, setIsVariablePrice] = useState(false);
  const [isChemical, setIsChemical] = useState(false);
  const [isMega, setIsMega] = useState(false);
  const [packageServices, setPackageServices] = useState("");
  const [packagePeriod, setPackagePeriod] = useState("mensal");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (service) {
      setTypeChoice(service.type);
      setName(service.name);
      setPrice(String(service.price));
      setDurationMinutes(String(service.duration_minutes ?? 60));
      setIsVariablePrice(service.is_variable_price ?? false);
      setIsChemical(service.is_chemical ?? false);
      setIsMega(service.is_mega ?? false);
      setPackageServices(service.package_services ?? "");
      setPackagePeriod(service.package_period ?? "mensal");
    } else {
      setTypeChoice(null);
      setName("");
      setPrice("");
      setDurationMinutes("60");
      setIsVariablePrice(false);
      setIsChemical(false);
      setIsMega(false);
      setPackageServices("");
      setPackagePeriod("mensal");
    }
    setError("");
  }, [open, service]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!typeChoice) return;
    if (!name.trim()) return setError("Informe o nome.");
    const priceNumber = Number(price);
    if (!price || Number.isNaN(priceNumber) || priceNumber <= 0) {
      return setError("Informe um preço válido.");
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      type: typeChoice,
      price: priceNumber,
      is_variable_price: isVariablePrice,
      is_chemical: typeChoice === "individual" ? isChemical : false,
      is_mega: typeChoice === "individual" ? isMega : false,
      is_active: true,
    };

    if (typeChoice === "individual") {
      payload.duration_minutes = Number(durationMinutes) || 60;
    } else {
      payload.package_services = packageServices.trim() || null;
      payload.package_period = packagePeriod;
    }

    setLoading(true);
    const { error: saveError } = service
      ? await supabase.from("services").update(payload).eq("id", service.id)
      : await supabase.from("services").insert(payload);

    setLoading(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }

    showToast(service ? "Serviço atualizado" : "Serviço criado");
    onSaved();
    onClose();
  }

  async function handleToggleActive() {
    if (!service) return;
    setLoading(true);
    const { error: toggleError } = await supabase
      .from("services")
      .update({ is_active: !service.is_active })
      .eq("id", service.id);
    setLoading(false);
    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    showToast(service.is_active ? "Serviço desativado" : "Serviço reativado");
    onSaved();
    onClose();
  }

  const showTypeChoice = !service && !typeChoice;

  return (
    <Modal open={open} onClose={onClose} title={service ? "Editar Serviço" : "Novo Serviço"}>
      {showTypeChoice ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTypeChoice("individual")}
            className="flex flex-col items-center gap-2 rounded-btn border border-border px-4 py-6 text-center transition duration-200 hover:border-gold"
          >
            <Scissors size={24} className="text-gold" strokeWidth={1.75} />
            <span className="text-sm text-text">Serviço Individual</span>
          </button>
          <button
            onClick={() => setTypeChoice("pacote")}
            className="flex flex-col items-center gap-2 rounded-btn border border-border px-4 py-6 text-center transition duration-200 hover:border-gold"
          >
            <Package size={24} className="text-gold" strokeWidth={1.75} />
            <span className="text-sm text-text">Pacote</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            className={cn(
              "flex items-center gap-2 rounded-btn border px-3 py-2 text-xs",
              "border-gold/30 bg-gold-dim text-gold-light"
            )}
          >
            {typeChoice === "individual" ? <Scissors size={14} /> : <Package size={14} />}
            {typeChoice === "individual" ? "Serviço Individual" : "Pacote"}
          </div>

          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Preço (R$)"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />

          <div className="rounded-btn border border-border p-3">
            <Toggle
              checked={isVariablePrice}
              onChange={setIsVariablePrice}
              label="Preço variável (a partir de)"
              description="Ative se o valor depende de cada cliente (tamanho, volume, estado)"
            />
          </div>

          {typeChoice === "individual" ? (
            <>
              <Input
                label="Duração (min)"
                type="number"
                min="0"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
              <div className="rounded-btn border border-border p-3">
                <Toggle
                  checked={isChemical}
                  onChange={setIsChemical}
                  label="Serviço químico"
                  description="Usa a comissão de químico da colaboradora em vez da comissão normal"
                />
              </div>
              <div className="rounded-btn border border-border p-3">
                <Toggle
                  checked={isMega}
                  onChange={setIsMega}
                  label="Mega Hair"
                  description="No agendamento o cliente só escolhe Aplicação/Manutenção — a técnica e os valores são preenchidos ao concluir o atendimento"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="package-services" className="text-sm text-textDim">
                  Serviços incluídos
                </label>
                <textarea
                  id="package-services"
                  value={packageServices}
                  onChange={(e) => setPackageServices(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-btn border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
                  placeholder="Descreva o que está incluído no pacote"
                />
              </div>
              <Select
                label="Período"
                value={packagePeriod}
                onChange={(e) => setPackagePeriod(e.target.value)}
              >
                {SERVICE_PACKAGE_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" loading={loading} className="mt-2 w-full">
            <Save size={16} />
            Salvar
          </Button>

          {service && (
            <Button
              type="button"
              variant={service.is_active ? "danger" : "secondary"}
              onClick={handleToggleActive}
              disabled={loading}
              className="w-full"
            >
              {service.is_active ? "Desativar serviço" : "Reativar serviço"}
            </Button>
          )}
        </form>
      )}
    </Modal>
  );
}

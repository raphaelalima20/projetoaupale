"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarPlus, AlertTriangle, Package } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PhoneInput from "@/components/ui/PhoneInput";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import Select from "@/components/ui/Select";
import ServiceSelect from "./ServiceSelect";
import CollaboratorSelect from "./CollaboratorSelect";
import { createClient } from "@/lib/supabase/client";
import { createAppointment } from "@/lib/appointments";
import { useToast } from "@/components/ui/Toast";
import { isBusinessDay, isPastDay, parseISODate, toISODate, hourFromTime } from "@/lib/schedule";
import { getBlockForDate, isHourBlocked } from "@/lib/scheduleBlocks";
import { findActivePackagesForPhone, packageSessionsRemaining } from "@/lib/packages";
import { formatCurrency } from "@/lib/utils";
import { MEGA_TIPO_OPTIONS } from "@/lib/mega";
import type { MegaTipo, Profile, Service, ScheduleBlock, ActivePackage } from "@/lib/types/database";

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  services: Service[];
  collaborators: Profile[];
  defaultDate?: Date;
  defaultHour?: number;
  defaultCollaboratorId?: string;
  openingTime: string;
  closingTime: string;
  scheduleBlocks: ScheduleBlock[];
}

export default function AppointmentModal({
  open,
  onClose,
  onCreated,
  services,
  collaborators,
  defaultDate,
  defaultHour,
  defaultCollaboratorId,
  openingTime,
  closingTime,
  scheduleBlocks,
}: AppointmentModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [priceOverride, setPriceOverride] = useState("");
  const [megaTipo, setMegaTipo] = useState<MegaTipo | "">("");
  const [collaboratorId, setCollaboratorId] = useState<string | null>(null);
  const [dateISO, setDateISO] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [activePackages, setActivePackages] = useState<ActivePackage[]>([]);
  const [usePackage, setUsePackage] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setClientName("");
    setPhone("");
    setServiceId(null);
    setPriceOverride("");
    setMegaTipo("");
    setCollaboratorId(defaultCollaboratorId ?? null);
    setDateISO(toISODate(defaultDate ?? new Date()));
    setTime(defaultHour !== undefined ? `${String(defaultHour).padStart(2, "0")}:00` : "");
    setNotes("");
    setError("");
    setActivePackages([]);
    setUsePackage(false);
    setSelectedPackageId(null);
  }, [open, defaultDate, defaultHour, defaultCollaboratorId]);

  useEffect(() => {
    if (!open || phone.length < 10) {
      setActivePackages([]);
      return;
    }
    let active = true;
    const timeout = setTimeout(async () => {
      const packages = await findActivePackagesForPhone(supabase, phone);
      if (active) setActivePackages(packages);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [open, phone, supabase]);

  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    if (selectedService?.is_variable_price) {
      setPriceOverride(String(selectedService.price));
    } else {
      setPriceOverride("");
    }
    setMegaTipo("");
  }, [selectedService]);

  const selectedCollaborator = collaborators.find((c) => c.id === collaboratorId);
  const blockForSelection =
    collaboratorId && dateISO ? getBlockForDate(scheduleBlocks, collaboratorId, dateISO) : null;
  const blockWarning =
    selectedCollaborator && time && dateISO && isHourBlocked(blockForSelection, hourFromTime(time), dateISO)
      ? `${selectedCollaborator.full_name} está indisponível neste horário.`
      : null;
  const selectedPackage = activePackages.find((p) => p.id === selectedPackageId) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!clientName.trim()) return setError("Informe o nome do cliente.");
    if (phone.length < 10) return setError("Informe um telefone válido.");
    if (usePackage) {
      if (!selectedPackage) return setError("Selecione um pacote.");
    } else if (!serviceId) {
      return setError("Selecione um serviço.");
    } else if (selectedService?.is_variable_price && Number(priceOverride) <= 0) {
      return setError("Informe o valor do serviço.");
    } else if (selectedService?.is_mega && !megaTipo) {
      return setError("Selecione Aplicação ou Manutenção.");
    }
    if (!collaboratorId) return setError("Selecione uma profissional.");
    if (!dateISO) return setError("Selecione uma data.");

    const date = parseISODate(dateISO);
    if (isPastDay(date)) return setError("Não é possível agendar em uma data passada.");
    if (!isBusinessDay(date)) return setError("O salão não funciona aos domingos.");
    if (!time) return setError("Selecione um horário.");
    const openingLabel = openingTime.slice(0, 5);
    const closingLabel = closingTime.slice(0, 5);
    if (time < openingLabel || time > closingLabel) {
      return setError(`Horário deve ser entre ${openingLabel} e ${closingLabel}.`);
    }

    const service = usePackage ? null : selectedService;
    if (!usePackage && !service) return setError("Serviço inválido.");
    const collaborator = collaborators.find((c) => c.id === collaboratorId);
    if (!collaborator) return setError("Profissional inválida.");

    const block = getBlockForDate(scheduleBlocks, collaboratorId, dateISO);
    if (isHourBlocked(block, hourFromTime(time), dateISO)) {
      return setError(`${collaborator.full_name} está indisponível neste horário.`);
    }

    setLoading(true);
    const { error: insertError } = await createAppointment({
      clientName,
      clientPhone: phone,
      service,
      servicePriceOverride:
        !usePackage && service?.is_variable_price ? Number(priceOverride) : null,
      packageSession:
        usePackage && selectedPackage
          ? {
              packageId: selectedPackage.id,
              packageName: selectedPackage.package_name,
            }
          : null,
      collaborator,
      dateISO,
      time,
      notes,
      megaTipo: !usePackage && selectedService?.is_mega ? (megaTipo as MegaTipo) : null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    showToast("Agendamento criado com sucesso");
    onCreated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Agendamento">
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

        {activePackages.length > 0 && (
          <div className="flex flex-col gap-2 rounded-btn border border-gold/30 bg-gold-dim p-3">
            <div className="flex items-center gap-2 text-xs text-gold-light">
              <Package size={14} />
              Este cliente tem {activePackages.length} pacote{activePackages.length > 1 ? "s" : ""}{" "}
              ativo{activePackages.length > 1 ? "s" : ""}
            </div>
            <Toggle checked={usePackage} onChange={setUsePackage} label="Usar pacote mensal" />
          </div>
        )}

        {usePackage ? (
          <>
            <Select
              label="Pacote"
              value={selectedPackageId ?? ""}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecione um pacote
              </option>
              {activePackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.package_name} ({packageSessionsRemaining(p)} sessões restantes)
                </option>
              ))}
            </Select>
            {selectedPackage && (
              <p className="-mt-2 text-xs text-textDim">
                {packageSessionsRemaining(selectedPackage)} de {selectedPackage.total_sessions}{" "}
                sessões restantes — o valor desta sessão será definido na conclusão do atendimento
              </p>
            )}
          </>
        ) : (
          <>
            <ServiceSelect services={services} value={serviceId} onChange={setServiceId} />
            {selectedService?.is_variable_price && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="price-override" className="text-sm text-textDim">
                  Valor do serviço (R$)
                </label>
                <Input
                  id="price-override"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  required
                />
                <p className="text-xs text-textDim">
                  Valor base: {formatCurrency(selectedService.price)} — ajuste conforme necessário
                </p>
              </div>
            )}
            {selectedService?.is_mega && (
              <Select
                label="Tipo"
                value={megaTipo}
                onChange={(e) => setMegaTipo(e.target.value as MegaTipo)}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {MEGA_TIPO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </>
        )}

        <CollaboratorSelect
          collaborators={collaborators}
          value={collaboratorId}
          onChange={setCollaboratorId}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data"
            type="date"
            value={dateISO}
            min={toISODate(new Date())}
            onChange={(e) => setDateISO(e.target.value)}
            required
          />
          <Input
            label="Horário"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            min={openingTime.slice(0, 5)}
            max={closingTime.slice(0, 5)}
            required
          />
        </div>

        {blockWarning && (
          <div className="flex items-center gap-2 rounded-btn border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            <AlertTriangle size={15} className="shrink-0" />
            {blockWarning}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-sm text-textDim">
            Observações
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-btn border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
            placeholder="Opcional"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} className="mt-2 w-full">
          <CalendarPlus size={16} />
          Criar agendamento
        </Button>
      </form>
    </Modal>
  );
}

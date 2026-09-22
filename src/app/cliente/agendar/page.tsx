"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Package } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PhoneInput from "@/components/ui/PhoneInput";
import Button from "@/components/ui/Button";
import StepIndicator from "@/components/ui/StepIndicator";
import Skeleton from "@/components/ui/Skeleton";
import ServiceSelect from "@/components/appointments/ServiceSelect";
import CollaboratorSelect from "@/components/appointments/CollaboratorSelect";
import { useServices } from "@/lib/hooks/useServices";
import { useCollaborators } from "@/lib/hooks/useCollaborators";
import { useSalonHours } from "@/lib/hooks/useSalonHours";
import { useScheduleBlocks } from "@/lib/hooks/useScheduleBlocks";
import { createClient } from "@/lib/supabase/client";
import { createAppointment } from "@/lib/appointments";
import {
  buildHourSlots,
  hourLabel,
  slotHourForTime,
  nextBusinessDays,
  toISODate,
  parseISODate,
  isSameDay,
  WEEKDAY_LABELS_SHORT,
} from "@/lib/schedule";
import { getBlockForDate, isDateFullyBlocked, isHourBlocked } from "@/lib/scheduleBlocks";
import { findActivePackagesForPhone, packageSessionsRemaining } from "@/lib/packages";
import { formatServicePriceText } from "@/lib/services";
import { formatDate, cn } from "@/lib/utils";
import { MEGA_TIPO_OPTIONS, megaTipoLabel } from "@/lib/mega";
import type { ActivePackage, MegaTipo } from "@/lib/types/database";

// 1 dados · 2 serviço · 3 tipo do mega (só quando o serviço é Mega Hair) · 4 profissional ·
// 5 data · 6 horário · 7 confirmar · 8 sucesso (fora do indicador, como o antigo passo de sucesso).
const TOTAL_STEPS = 7;

export default function AgendarPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const { services, loading: loadingServices } = useServices();
  const { collaborators, loading: loadingCollaborators } = useCollaborators();
  const { openingTime, closingTime } = useSalonHours();
  const hours = useMemo(() => buildHourSlots(openingTime, closingTime), [openingTime, closingTime]);
  const minHour = hours[0];
  const maxHour = hours[hours.length - 1];
  const { blocks: scheduleBlocks } = useScheduleBlocks();

  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [megaTipo, setMegaTipo] = useState<MegaTipo | null>(null);
  const [collaboratorId, setCollaboratorId] = useState<string | null>(null);
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [occupiedTimes, setOccupiedTimes] = useState<string[]>([]);
  const [loadingOccupied, setLoadingOccupied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [activePackages, setActivePackages] = useState<ActivePackage[]>([]);
  const [showPackagePicker, setShowPackagePicker] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const availableDays = nextBusinessDays(18);
  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    setMegaTipo(null);
  }, [serviceId]);
  const selectedPackage = activePackages.find((p) => p.id === selectedPackageId) ?? null;
  const selectedCollaborator = collaborators.find((c) => c.id === collaboratorId) ?? null;
  const today = new Date();

  useEffect(() => {
    if (phone.length !== 11) {
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
  }, [phone, supabase]);

  useEffect(() => {
    if (step !== 6 || !collaboratorId || !dateISO) return;
    let active = true;
    setLoadingOccupied(true);
    supabase
      .from("busy_slots")
      .select("appointment_time")
      .eq("collaborator_id", collaboratorId)
      .eq("appointment_date", dateISO)
      .then(({ data }) => {
        if (!active) return;
        setOccupiedTimes(
          (data ?? []).map((r: { appointment_time: string }) =>
            hourLabel(slotHourForTime(r.appointment_time, minHour, maxHour))
          )
        );
        setLoadingOccupied(false);
      });
    return () => {
      active = false;
    };
  }, [step, collaboratorId, dateISO, supabase, minHour, maxHour]);

  function goBack() {
    if (step === 1) {
      router.push("/cliente");
      return;
    }
    // Passo 4 (profissional) é o único com mais de uma origem possível: pacote pula direto de 1,
    // Mega Hair vem do passo 3 (tipo), os demais serviços vêm do passo 2.
    if (step === 4) {
      if (selectedPackage) {
        setStep(1);
      } else {
        setStep(selectedService?.is_mega ? 3 : 2);
      }
      return;
    }
    setStep((s) => s - 1);
  }

  function handleStep1Continue(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!clientName.trim()) {
      setError("Informe seu nome completo.");
      return;
    }
    if (phone.length < 10) {
      setError("Informe um telefone válido.");
      return;
    }
    setStep(selectedPackage ? 4 : 2);
  }

  async function handleConfirm() {
    if (!selectedCollaborator || !dateISO || !time) return;
    if (!selectedPackage && !selectedService) return;
    setSubmitting(true);
    setError("");
    const { error: insertError } = await createAppointment({
      clientName,
      clientPhone: phone,
      service: selectedPackage ? null : selectedService,
      packageSession: selectedPackage
        ? {
            packageId: selectedPackage.id,
            packageName: selectedPackage.package_name,
          }
        : null,
      collaborator: selectedCollaborator,
      dateISO,
      time,
      megaTipo: selectedPackage ? null : megaTipo,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setStep(8);
  }

  return (
    <div className="animate-fadeIn">
      {step <= TOTAL_STEPS && (
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={goBack}
            aria-label="Voltar"
            className="shrink-0 rounded-btn border border-border p-2 text-textDim transition duration-200 hover:border-gold hover:text-gold"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <StepIndicator total={TOTAL_STEPS} current={step} />
          </div>
        </div>
      )}

      {step === 1 && (
        <Card>
          <h1 className="mb-1 font-display text-xl text-text">Seus dados</h1>
          <p className="mb-6 text-sm text-textDim">Como podemos te chamar?</p>
          <form onSubmit={handleStep1Continue} className="flex flex-col gap-4">
            <Input
              label="Nome completo"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              autoFocus
            />
            <PhoneInput value={phone} onChange={setPhone} required />

            {activePackages.length > 0 && (
              <div className="flex flex-col gap-2 rounded-btn border border-gold/30 bg-gold-dim p-3">
                <button
                  type="button"
                  onClick={() => setShowPackagePicker((v) => !v)}
                  className="flex items-center gap-2 text-sm text-gold-light"
                >
                  <Package size={15} />
                  Tenho um pacote mensal
                </button>
                {showPackagePicker && (
                  <div className="flex flex-col gap-2">
                    {activePackages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPackageId(selectedPackageId === p.id ? null : p.id)}
                        className={cn(
                          "rounded-btn border px-3 py-2 text-left text-xs transition duration-200",
                          selectedPackageId === p.id
                            ? "border-gold bg-surface text-gold-light"
                            : "border-border/60 bg-surface text-textDim hover:border-gold/50"
                        )}
                      >
                        <p className="text-sm text-text">{p.package_name}</p>
                        <p className="mt-0.5">{packageSessionsRemaining(p)} sessões restantes</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="mt-2 w-full">
              Continuar
            </Button>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h1 className="mb-1 font-display text-xl text-text">Escolha o serviço</h1>
          <p className="mb-6 text-sm text-textDim">Selecione o que deseja agendar</p>
          {loadingServices ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <ServiceSelect
              services={services}
              value={serviceId}
              variant="cards"
              onChange={(id) => {
                setServiceId(id);
                const service = services.find((s) => s.id === id);
                setStep(service?.is_mega ? 3 : 4);
              }}
            />
          )}
        </Card>
      )}

      {step === 3 && selectedService?.is_mega && (
        <Card>
          <h1 className="mb-1 font-display text-xl text-text">{selectedService.name}</h1>
          <p className="mb-6 text-sm text-textDim">É aplicação ou manutenção?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MEGA_TIPO_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setMegaTipo(o.value);
                  setStep(4);
                }}
                className={cn(
                  "rounded-btn border px-4 py-6 text-center text-sm font-medium transition duration-200",
                  megaTipo === o.value
                    ? "border-gold bg-gold-dim text-gold-light"
                    : "border-border text-text hover:border-gold/50"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <h1 className="mb-1 font-display text-xl text-text">Escolha a profissional</h1>
          <p className="mb-6 text-sm text-textDim">Quem vai te atender</p>
          {loadingCollaborators ? (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <CollaboratorSelect
              collaborators={collaborators}
              value={collaboratorId}
              variant="cards"
              onChange={(id) => {
                setCollaboratorId(id);
                setStep(5);
              }}
            />
          )}
        </Card>
      )}

      {step === 5 && (
        <Card>
          <h1 className="mb-1 font-display text-xl text-text">Escolha a data</h1>
          <p className="mb-6 text-sm text-textDim">Segunda a sábado</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {availableDays.map((day) => {
              const iso = toISODate(day);
              const selected = dateISO === iso;
              const blocked =
                !!collaboratorId &&
                isDateFullyBlocked(
                  getBlockForDate(scheduleBlocks, collaboratorId, iso),
                  iso,
                  minHour,
                  maxHour
                );
              return (
                <button
                  key={iso}
                  disabled={blocked}
                  onClick={() => {
                    setDateISO(iso);
                    setStep(6);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-btn border px-2 py-3 transition duration-200",
                    blocked
                      ? "cursor-not-allowed border-border/50 text-textDim/40"
                      : selected
                        ? "border-gold bg-gold-dim text-gold-light"
                        : "border-border text-textDim hover:border-gold/50 hover:text-text"
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wide">
                    {WEEKDAY_LABELS_SHORT[day.getDay()]}
                  </span>
                  <span className="text-sm font-medium">
                    {String(day.getDate()).padStart(2, "0")}/
                    {String(day.getMonth() + 1).padStart(2, "0")}
                  </span>
                  {blocked && <span className="text-[9px]">Indisponível</span>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {step === 6 && dateISO && (
        <Card>
          <h1 className="mb-1 font-display text-xl text-text">Escolha o horário</h1>
          <p className="mb-6 text-sm text-textDim">{formatDate(parseISODate(dateISO))}</p>
          {loadingOccupied ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {hours.map((hour) => {
                const label = hourLabel(hour);
                const isToday = isSameDay(parseISODate(dateISO), today);
                const isPast = isToday && hour <= today.getHours();
                const block = collaboratorId
                  ? getBlockForDate(scheduleBlocks, collaboratorId, dateISO)
                  : null;
                const occupied =
                  occupiedTimes.includes(label) || isPast || isHourBlocked(block, hour, dateISO);
                return (
                  <button
                    key={hour}
                    disabled={occupied}
                    onClick={() => {
                      setTime(label);
                      setStep(7);
                    }}
                    className={cn(
                      "rounded-btn border px-2 py-3 text-sm font-medium transition duration-200",
                      occupied
                        ? "cursor-not-allowed border-border/50 text-textDim/40"
                        : "border-gold/40 text-gold hover:bg-gold-dim"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {step === 7 && (selectedService || selectedPackage) && selectedCollaborator && dateISO && time && (
        <Card>
          <h1 className="mb-1 font-display text-xl text-text">Confirme seu agendamento</h1>
          <p className="mb-6 text-sm text-textDim">Revise os detalhes antes de confirmar</p>
          <div className="flex flex-col gap-3 rounded-btn bg-surface2 p-4 text-sm">
            <SummaryRow label="Serviço" value={selectedPackage ? selectedPackage.package_name : selectedService!.name} />
            {megaTipo && <SummaryRow label="Tipo" value={megaTipoLabel(megaTipo)} />}
            <SummaryRow label="Profissional" value={selectedCollaborator.full_name} />
            <SummaryRow label="Data" value={formatDate(parseISODate(dateISO))} />
            <SummaryRow label="Horário" value={time} />
            {selectedPackage ? (
              <SummaryRow
                label="Pacote"
                value={`${packageSessionsRemaining(selectedPackage)} sessões restantes`}
              />
            ) : (
              <SummaryRow
                label="Valor"
                value={formatServicePriceText(selectedService!.price, selectedService!.is_variable_price)}
              />
            )}
          </div>
          {!selectedPackage && selectedService!.is_variable_price && <VariablePriceNotice />}
          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          <Button onClick={handleConfirm} loading={submitting} className="mt-6 w-full">
            Confirmar Agendamento
          </Button>
        </Card>
      )}

      {step === 8 && (selectedService || selectedPackage) && selectedCollaborator && dateISO && time && (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 size={32} className="text-success" />
          </div>
          <div>
            <h1 className="font-display text-xl text-text">Agendamento Confirmado!</h1>
            <p className="mt-1 text-sm text-textDim">Te esperamos no salão</p>
          </div>
          <div className="flex w-full flex-col gap-3 rounded-btn bg-surface2 p-4 text-left text-sm">
            <SummaryRow label="Serviço" value={selectedPackage ? selectedPackage.package_name : selectedService!.name} />
            {megaTipo && <SummaryRow label="Tipo" value={megaTipoLabel(megaTipo)} />}
            <SummaryRow label="Profissional" value={selectedCollaborator.full_name} />
            <SummaryRow label="Data" value={formatDate(parseISODate(dateISO))} />
            <SummaryRow label="Horário" value={time} />
          </div>
          {!selectedPackage && selectedService!.is_variable_price && <VariablePriceNotice />}
          <Button onClick={() => router.push("/cliente")} className="mt-2 w-full">
            Voltar ao início
          </Button>
        </Card>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-textDim">{label}</span>
      <span className="text-right text-text">{value}</span>
    </div>
  );
}

function VariablePriceNotice() {
  return (
    <p className="mt-3 text-xs text-textDim">
      * O valor final pode variar conforme o serviço (tamanho, volume e estado). O valor exato
      será informado pela profissional no salão.
    </p>
  );
}

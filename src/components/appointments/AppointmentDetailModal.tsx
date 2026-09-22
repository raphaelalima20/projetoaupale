"use client";

import { useEffect, useState } from "react";
import {
  User,
  Phone,
  Scissors,
  CalendarDays,
  Clock,
  StickyNote,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  X,
  Package,
  Ribbon,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Toggle from "@/components/ui/Toggle";
import AppointmentStatusBadge from "./StatusBadge";
import PaymentMethodSelect from "./PaymentMethodSelect";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatServicePriceText } from "@/lib/services";
import { formatCurrency, formatPhone, formatDate, cn } from "@/lib/utils";
import { formatTimeLabel, parseISODate } from "@/lib/schedule";
import { PAYMENT_METHODS } from "@/lib/constants";
import { MEGA_COMBINACAO_OPTIONS, MEGA_TECNICA_OPTIONS, MEGA_TIPO_OPTIONS, megaTipoLabel } from "@/lib/mega";
import type {
  Appointment,
  ClientPackage,
  MegaCombinacao,
  MegaEspecificacao,
  MegaTecnica,
  MegaTipo,
  PaymentMethod,
  Profile,
  RemunerationType,
} from "@/lib/types/database";

interface AppointmentDetailModalProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  collaborator?: Profile;
  canManage: boolean;
  onUpdated: () => void;
  cashRegisterId?: string | null;
}

type SubView = "details" | "payment" | "package-confirm" | "cancel-confirm";
interface ExtraService {
  id: string;
  name: string;
  value: string;
}

export default function AppointmentDetailModal({
  open,
  onClose,
  appointment,
  collaborator,
  canManage,
  onUpdated,
  cashRegisterId = null,
}: AppointmentDetailModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile: authProfile } = useAuth();
  const isAdmin = authProfile?.role === "admin";
  const [subView, setSubView] = useState<SubView>("details");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [extras, setExtras] = useState<ExtraService[]>([]);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraName, setExtraName] = useState("");
  const [extraValue, setExtraValue] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"reais" | "percent">("reais");
  const [surchargeValue, setSurchargeValue] = useState("");
  const [surchargeDesc, setSurchargeDesc] = useState("");

  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [paymentMethod2, setPaymentMethod2] = useState<PaymentMethod | null>(null);
  const [paymentAmount1, setPaymentAmount1] = useState("");
  const [paymentAmount2, setPaymentAmount2] = useState("");
  const [packageInfo, setPackageInfo] = useState<ClientPackage | null>(null);
  const [packageSessionValueInput, setPackageSessionValueInput] = useState("");
  const [serviceIsVariablePrice, setServiceIsVariablePrice] = useState(false);
  const [serviceIsChemical, setServiceIsChemical] = useState(false);
  const [serviceIsMega, setServiceIsMega] = useState(false);
  /** The collaborator's configured rate for this service (admin only) — pre-fills the commission. */
  const [defaultPercentage, setDefaultPercentage] = useState<number | null>(null);

  // Funcionalidade 2 — comissão por percentual (padrão) ou valor fixo negociado. Admin only.
  const [remunerationType, setRemunerationType] = useState<RemunerationType>("comissao");
  const [valorFixoInput, setValorFixoInput] = useState("");
  const [commissionMode, setCommissionMode] = useState<"reais" | "percent">("percent");
  const [commissionInputValue, setCommissionInputValue] = useState("");

  // Mega Hair — preenchido só no fechamento, por quem estiver concluindo (admin ou colaboradora).
  const [megaTecnica, setMegaTecnica] = useState<MegaTecnica | "">("");
  const [megaTipoValue, setMegaTipoValue] = useState<MegaTipo | "">("");
  const [megaCombinacao, setMegaCombinacao] = useState<MegaCombinacao | "">("");
  const [megaComprimento, setMegaComprimento] = useState("");
  const [megaGramas, setMegaGramas] = useState("");
  const [megaValorTecnica, setMegaValorTecnica] = useState("");
  const [megaValorCabelo, setMegaValorCabelo] = useState("");
  /** Histórico — só carregado quando o atendimento já foi concluído. */
  const [megaHistory, setMegaHistory] = useState<MegaEspecificacao | null>(null);

  useEffect(() => {
    if (open) {
      setSubView("details");
      setPaymentMethod(null);
      setError("");
      setExtras([]);
      setShowExtraForm(false);
      setExtraName("");
      setExtraValue("");
      setDiscountValue("");
      setDiscountType("reais");
      setSurchargeValue("");
      setSurchargeDesc("");
      setIsSplitPayment(false);
      setPaymentMethod2(null);
      setPaymentAmount1("");
      setPaymentAmount2("");
      setPackageInfo(null);
      setPackageSessionValueInput("");
      setServiceIsVariablePrice(false);
      setServiceIsChemical(false);
      setServiceIsMega(false);
      setDefaultPercentage(null);
      setRemunerationType("comissao");
      setValorFixoInput("");
      setCommissionMode("percent");
      setCommissionInputValue("");
      setMegaTecnica("");
      setMegaTipoValue("");
      setMegaCombinacao("");
      setMegaComprimento("");
      setMegaGramas("");
      setMegaValorTecnica("");
      setMegaValorCabelo("");
      setMegaHistory(null);
    }
  }, [open, appointment?.id]);

  useEffect(() => {
    if (
      !open ||
      !appointment?.service_id ||
      appointment.status !== "agendado" ||
      appointment.is_package_session
    ) {
      return;
    }
    let active = true;
    supabase
      .from("services")
      .select("is_variable_price, is_chemical, is_mega")
      .eq("id", appointment.service_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setServiceIsVariablePrice(data?.is_variable_price ?? false);
        setServiceIsChemical(data?.is_chemical ?? false);
        setServiceIsMega(data?.is_mega ?? false);
      });
    return () => {
      active = false;
    };
  }, [open, appointment?.service_id, appointment?.status, appointment?.is_package_session, supabase]);

  // Pré-preenche o "Tipo" com o que o cliente escolheu no agendamento — a admin/colaboradora pode ajustar.
  useEffect(() => {
    if (!open) return;
    setMegaTipoValue((appointment?.mega_tipo as MegaTipo | null) ?? "");
  }, [open, appointment?.mega_tipo]);

  useEffect(() => {
    if (!open || !appointment?.is_package_session || !appointment.package_id) return;
    let active = true;
    supabase
      .from("client_packages")
      .select("*")
      .eq("id", appointment.package_id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setPackageInfo((data as ClientPackage) ?? null);
      });
    return () => {
      active = false;
    };
  }, [open, appointment?.is_package_session, appointment?.package_id, supabase]);

  // Histórico do Mega Hair — visível na aba de detalhes assim que o atendimento é concluído.
  useEffect(() => {
    if (!open || appointment?.status !== "concluido" || !appointment.id) {
      setMegaHistory(null);
      return;
    }
    let active = true;
    supabase
      .from("mega_especificacoes")
      .select("*")
      .eq("agendamento_id", appointment.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setMegaHistory((data as MegaEspecificacao) ?? null);
      });
    return () => {
      active = false;
    };
  }, [open, appointment?.status, appointment?.id, supabase]);

  // Admin only: pre-fill the commission with the collaborator's own rate (normal or "químico").
  useEffect(() => {
    if (!open || !isAdmin || appointment?.status !== "agendado" || !appointment.collaborator_id) return;
    let active = true;
    supabase
      .from("profiles")
      .select("commission_percentage, commission_chemical_percentage")
      .eq("id", appointment.collaborator_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const pct = Number(
          serviceIsChemical ? data.commission_chemical_percentage : data.commission_percentage
        );
        setDefaultPercentage(pct > 0 ? pct : null);
        if (pct > 0) {
          setCommissionMode("percent");
          setCommissionInputValue((current) => (current === "" ? String(pct) : current));
        }
      });
    return () => {
      active = false;
    };
  }, [open, isAdmin, appointment?.status, appointment?.collaborator_id, serviceIsChemical, supabase]);

  if (!appointment) return null;

  const basePrice = appointment.service_price;
  const extrasTotal = extras.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
  const subtotal = basePrice + extrasTotal;
  const discountNumber = Number(discountValue) || 0;
  const discountAmount =
    discountType === "percent" ? (subtotal * discountNumber) / 100 : discountNumber;
  const surchargeNumber = Number(surchargeValue) || 0;
  const regularFinalAmount =
    Math.round(Math.max(0, subtotal - discountAmount + surchargeNumber) * 100) / 100;

  const megaValorTecnicaNumber = Number(megaValorTecnica) || 0;
  const megaValorCabeloNumber = Number(megaValorCabelo) || 0;
  const megaValid =
    !serviceIsMega ||
    (megaTecnica !== "" &&
      megaTipoValue !== "" &&
      megaCombinacao !== "" &&
      megaValorTecnicaNumber > 0 &&
      !Number.isNaN(megaValorTecnicaNumber) &&
      (megaValorCabelo === "" || megaValorCabeloNumber >= 0));

  // Mega Hair's total is always técnica + cabelo — no extras/discount/surcharge for this service.
  const finalAmount = serviceIsMega
    ? Math.round((megaValorTecnicaNumber + megaValorCabeloNumber) * 100) / 100
    : regularFinalAmount;

  const amount1 = Number(paymentAmount1) || 0;
  const amount2 = Number(paymentAmount2) || 0;
  const splitSumMatches = Math.abs(amount1 + amount2 - finalAmount) < 0.01;

  const isPromissoria = !isSplitPayment && paymentMethod === "promissoria";
  const requiresOpenCash = isSplitPayment || !isPromissoria;
  const cashBlocked = requiresOpenCash && !cashRegisterId;

  const packageSessionValueNumber = Number(packageSessionValueInput) || 0;

  // Commission base — for Mega Hair this is ALWAYS valor_tecnica, never valor_cabelo.
  const commissionBaseAmount = serviceIsMega
    ? megaValorTecnicaNumber
    : subView === "package-confirm"
      ? packageSessionValueNumber
      : finalAmount;
  const commissionNumber = Number(commissionInputValue);
  const hasValidCommission =
    commissionInputValue.trim() !== "" && !Number.isNaN(commissionNumber) && commissionNumber >= 0;
  const commissionValue = !hasValidCommission
    ? 0
    : commissionMode === "percent"
      ? Math.round(((commissionBaseAmount * commissionNumber) / 100) * 100) / 100
      : Math.round(commissionNumber * 100) / 100;

  const valorFixoNumber = Number(valorFixoInput);
  const hasValidValorFixo =
    valorFixoInput.trim() !== "" && !Number.isNaN(valorFixoNumber) && valorFixoNumber >= 0;
  const remunerationValid = remunerationType === "valor_fixo" ? hasValidValorFixo : hasValidCommission;

  const canConfirm =
    !cashBlocked &&
    megaValid &&
    (!isAdmin || remunerationValid) &&
    (isSplitPayment
      ? !!paymentMethod && !!paymentMethod2 && amount1 > 0 && amount2 > 0 && splitSumMatches
      : !!paymentMethod);

  // Collaborators don't type a session value or a commission: the server derives both.
  const canConfirmPackage =
    !isAdmin || (packageSessionValueNumber > 0 && remunerationValid);

  function handleAddExtra() {
    if (!extraName.trim() || !extraValue || Number(extraValue) <= 0) return;
    setExtras((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: extraName.trim(), value: extraValue },
    ]);
    setExtraName("");
    setExtraValue("");
    setShowExtraForm(false);
  }

  function handleRemoveExtra(id: string) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  function handleToggleSplit(checked: boolean) {
    setIsSplitPayment(checked);
    if (checked) {
      setPaymentAmount1(finalAmount.toFixed(2));
      setPaymentAmount2("0");
    }
  }

  function remunerationPayload() {
    return remunerationType === "valor_fixo"
      ? { remunerationType: "valor_fixo" as const, valorFixo: valorFixoNumber }
      : { remunerationType: "comissao" as const, commissionValue };
  }

  async function handleConclude() {
    if (!appointment || !canConfirm) return;
    setError("");
    setLoading(true);

    const extrasDescriptions = extras.map((e) => `${e.name} (${formatCurrency(Number(e.value))})`);
    if (surchargeNumber > 0 && surchargeDesc.trim()) {
      extrasDescriptions.push(surchargeDesc.trim());
    }

    const res = await fetch("/api/appointments/conclude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appointment.id,
        paymentMethod,
        discountAmount: serviceIsMega ? 0 : Math.round(discountAmount * 100) / 100,
        surchargeAmount: serviceIsMega ? 0 : Math.round((extrasTotal + surchargeNumber) * 100) / 100,
        surchargeDescription: serviceIsMega
          ? null
          : extrasDescriptions.length > 0
            ? extrasDescriptions.join(" · ")
            : null,
        finalAmount,
        // Only an admin may set the commission/valor fixo by hand; otherwise the server applies the rate.
        ...(isAdmin ? remunerationPayload() : {}),
        isSplitPayment,
        paymentMethod2: isSplitPayment ? paymentMethod2 : null,
        paymentAmount1: isSplitPayment ? amount1 : null,
        paymentAmount2: isSplitPayment ? amount2 : null,
        ...(serviceIsMega
          ? {
              megaSpec: {
                tecnica: megaTecnica,
                tipo: megaTipoValue,
                combinacao: megaCombinacao,
                comprimento: megaComprimento.trim() || null,
                gramas: megaGramas === "" ? null : Number(megaGramas),
                valorTecnica: megaValorTecnicaNumber,
                valorCabelo: megaValorCabelo === "" ? 0 : megaValorCabeloNumber,
              },
            }
          : {}),
      }),
    });
    const body = await res.json();

    setLoading(false);
    if (!res.ok) {
      showToast(body.error ?? "Não foi possível concluir o atendimento.", "error");
      return;
    }

    showToast("Atendimento concluído");
    onUpdated();
    onClose();
  }

  async function handleConcludePackage() {
    if (!appointment || !canConfirmPackage) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/appointments/conclude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appointment.id,
        ...(isAdmin ? { packageSessionValue: packageSessionValueNumber, ...remunerationPayload() } : {}),
      }),
    });
    const body = await res.json();

    setLoading(false);
    if (!res.ok) {
      showToast(body.error ?? "Não foi possível concluir a sessão.", "error");
      return;
    }

    const used = (packageInfo?.used_sessions ?? 0) + 1;
    const total = packageInfo?.total_sessions;
    showToast(total ? `Sessão concluída — ${used} de ${total} sessões usadas` : "Sessão concluída");
    onUpdated();
    onClose();
  }

  async function handleCancel() {
    if (!appointment) return;
    setLoading(true);
    const { error: cancelError } = await supabase
      .from("appointments")
      .update({ status: "cancelado" })
      .eq("id", appointment.id);

    setLoading(false);
    if (cancelError) {
      showToast(cancelError.message, "error");
      return;
    }
    showToast("Agendamento cancelado", "info");
    onUpdated();
    onClose();
  }

  const paymentUsed = PAYMENT_METHODS.find((p) => p.value === appointment.payment_method);

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do Agendamento">
      {subView === "details" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <User size={17} className="mt-0.5 shrink-0 text-textDim" />
            <div>
              <p className="text-sm font-medium text-text">{appointment.client_name}</p>
              <p className="flex items-center gap-1.5 text-xs text-textDim">
                <Phone size={12} />
                {formatPhone(appointment.client_phone)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Scissors size={17} className="mt-0.5 shrink-0 text-textDim" />
            <div>
              <p className="text-sm text-text">{appointment.service_name}</p>
              {appointment.is_package_session && appointment.status !== "concluido" ? (
                <p className="text-xs text-textDim">Valor da sessão será definido na conclusão</p>
              ) : (
                <>
                  <p className="text-xs text-textDim">
                    {appointment.status === "agendado"
                      ? formatServicePriceText(appointment.service_price, serviceIsVariablePrice)
                      : formatCurrency(
                          appointment.final_amount ??
                            appointment.package_session_value ??
                            appointment.service_price
                        )}
                  </p>
                  <p className="text-xs text-textDim">
                    {appointment.tipo_remuneracao === "valor_fixo" ? "Valor fixo" : "Comissão"}:{" "}
                    {formatCurrency(appointment.commission_value)}
                  </p>
                </>
              )}
              {appointment.is_package_session && packageInfo && (
                <p className="text-xs text-gold">
                  Sessão{" "}
                  {appointment.status === "concluido"
                    ? packageInfo.used_sessions
                    : Math.min(packageInfo.used_sessions + 1, packageInfo.total_sessions)}{" "}
                  de {packageInfo.total_sessions}
                </p>
              )}
              {appointment.mega_tipo && appointment.status === "agendado" && (
                <p className="text-xs text-gold">{megaTipoLabel(appointment.mega_tipo)}</p>
              )}
            </div>
          </div>

          {collaborator && (
            <div className="flex items-start gap-3">
              <User size={17} className="mt-0.5 shrink-0 text-textDim" />
              <p className="text-sm text-text">{collaborator.full_name}</p>
            </div>
          )}

          <div className="flex items-start gap-3">
            <CalendarDays size={17} className="mt-0.5 shrink-0 text-textDim" />
            <p className="text-sm text-text">
              {formatDate(parseISODate(appointment.appointment_date))}
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Clock size={17} className="mt-0.5 shrink-0 text-textDim" />
            <p className="text-sm text-text">{formatTimeLabel(appointment.appointment_time)}</p>
          </div>

          {appointment.notes && (
            <div className="flex items-start gap-3">
              <StickyNote size={17} className="mt-0.5 shrink-0 text-textDim" />
              <p className="text-sm text-textDim">{appointment.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Badge tone="neutral">{appointment.origin === "app" ? "Pelo App" : "Manual"}</Badge>
            <AppointmentStatusBadge status={appointment.status} />
            {appointment.is_package_session && (
              <Badge tone="info">
                <Package size={11} className="mr-1" />
                Sessão de Pacote
              </Badge>
            )}
            {appointment.status === "concluido" && appointment.tipo_remuneracao === "valor_fixo" && (
              <Badge tone="pink">Valor fixo</Badge>
            )}
            {appointment.status === "concluido" && appointment.payment_method === "promissoria" && (
              <Badge tone="orange">A prazo</Badge>
            )}
          </div>

          {megaHistory && (
            <div className="flex flex-col gap-2 rounded-btn border border-gold/30 bg-gold-dim p-4">
              <div className="flex items-center gap-2 text-sm text-gold-light">
                <Ribbon size={15} />
                Especificações do Mega Hair
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-textDim">
                <MegaInfoRow label="Técnica" value={MEGA_TECNICA_OPTIONS.find((o) => o.value === megaHistory.tecnica)?.label ?? megaHistory.tecnica} />
                <MegaInfoRow label="Tipo" value={megaTipoLabel(megaHistory.tipo)} />
                <MegaInfoRow label="Combinação" value={megaHistory.combinacao} />
                <MegaInfoRow label="Comprimento" value={megaHistory.comprimento ?? "—"} />
                <MegaInfoRow label="Gramas" value={megaHistory.gramas != null ? `${megaHistory.gramas}g` : "—"} />
                <MegaInfoRow label="Valor técnica" value={formatCurrency(megaHistory.valor_tecnica)} />
                <MegaInfoRow label="Valor cabelo" value={formatCurrency(megaHistory.valor_cabelo)} />
              </div>
            </div>
          )}

          {appointment.status === "concluido" && appointment.is_package_session && (
            <div className="rounded-btn bg-surface2 p-3 text-sm text-textDim">
              Sessão de pacote — valor já pago na compra do pacote
              {appointment.concluded_at && (
                <>
                  {" "}
                  em{" "}
                  <span className="text-text">
                    {formatDate(new Date(appointment.concluded_at))}
                  </span>
                </>
              )}
            </div>
          )}

          {appointment.status === "concluido" && !appointment.is_package_session && (
            <div className="rounded-btn bg-surface2 p-3 text-sm text-textDim">
              Pago via <span className="text-text">{paymentUsed?.label ?? "—"}</span>
              {appointment.is_split_payment && appointment.payment_method_2 && (
                <>
                  {" "}
                  e{" "}
                  <span className="text-text">
                    {PAYMENT_METHODS.find((p) => p.value === appointment.payment_method_2)?.label}
                  </span>
                </>
              )}
              {appointment.concluded_at && (
                <>
                  {" "}
                  em{" "}
                  <span className="text-text">
                    {formatDate(new Date(appointment.concluded_at))}
                  </span>
                </>
              )}
              {appointment.surcharge_description && (
                <p className="mt-1 text-xs text-textDim">{appointment.surcharge_description}</p>
              )}
            </div>
          )}

          {appointment.status === "agendado" && canManage && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {!cashRegisterId && !appointment.is_package_session && (
                <div className="flex items-center gap-2 rounded-btn border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                  <AlertCircle size={15} className="shrink-0" />
                  O caixa está fechado — só é possível concluir como Promissória (a prazo).
                </div>
              )}
              <Button
                onClick={() => setSubView(appointment.is_package_session ? "package-confirm" : "payment")}
                className="w-full"
              >
                <CheckCircle2 size={16} />
                Concluir Atendimento
              </Button>
              <Button
                variant="danger"
                onClick={() => setSubView("cancel-confirm")}
                className="w-full"
              >
                <XCircle size={16} />
                Cancelar Agendamento
              </Button>
            </div>
          )}
        </div>
      )}

      {subView === "payment" && (
        <div className="flex flex-col gap-5">
          {serviceIsMega ? (
            <div className="flex flex-col gap-3 rounded-btn border border-gold/30 bg-gold-dim p-4">
              <div className="flex items-center gap-2 text-sm text-gold-light">
                <Ribbon size={16} />
                Especificações do Mega Hair
              </div>
              <p className="text-xs text-textDim">
                A comissão da colaboradora incide só sobre o valor da técnica — o valor do cabelo
                nunca entra nessa conta.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Técnica"
                  value={megaTecnica}
                  onChange={(e) => setMegaTecnica(e.target.value as MegaTecnica)}
                  required
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {MEGA_TECNICA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Tipo"
                  value={megaTipoValue}
                  onChange={(e) => setMegaTipoValue(e.target.value as MegaTipo)}
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
              </div>

              <Select
                label="Combinação"
                value={megaCombinacao}
                onChange={(e) => setMegaCombinacao(e.target.value as MegaCombinacao)}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {MEGA_COMBINACAO_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Comprimento"
                  value={megaComprimento}
                  onChange={(e) => setMegaComprimento(e.target.value)}
                  placeholder="Ex: 60cm"
                />
                <Input
                  label="Gramas de cabelo"
                  type="number"
                  min="0"
                  step="1"
                  value={megaGramas}
                  onChange={(e) => setMegaGramas(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Valor da técnica (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={megaValorTecnica}
                  onChange={(e) => setMegaValorTecnica(e.target.value)}
                  required
                />
                <Input
                  label="Valor do cabelo (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={megaValorCabelo}
                  onChange={(e) => setMegaValorCabelo(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div className="flex items-center justify-between border-t border-gold/30 pt-3">
                <span className="text-sm text-textDim">Total (técnica + cabelo)</span>
                <span className="font-display text-2xl text-gold-light">
                  {formatCurrency(finalAmount)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-btn border border-border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-textDim">{appointment.service_name}</span>
                <span className="text-text">{formatCurrency(basePrice)}</span>
              </div>

              {extras.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-textDim">{e.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text">{formatCurrency(Number(e.value))}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtra(e.id)}
                      aria-label="Remover"
                      className="text-textDim transition duration-200 hover:text-danger"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {showExtraForm ? (
                <div className="flex flex-col gap-2 rounded-btn bg-surface2 p-3">
                  <Input
                    label="Serviço extra"
                    value={extraName}
                    onChange={(e) => setExtraName(e.target.value)}
                    placeholder="Ex: Escova"
                    autoFocus
                  />
                  <Input
                    label="Valor (R$)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraValue}
                    onChange={(e) => setExtraValue(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowExtraForm(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" onClick={handleAddExtra} className="flex-1">
                      Adicionar
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowExtraForm(true)}
                  className="flex items-center gap-1.5 self-start text-xs text-gold transition duration-200 hover:text-gold-light"
                >
                  <Plus size={14} />
                  Adicionar serviço extra
                </button>
              )}

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-textDim">Desconto</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                    className="w-full min-w-0 rounded-btn border border-border bg-surface2 px-3 py-1.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
                  />
                  <div className="flex shrink-0 overflow-hidden rounded-btn border border-border">
                    <button
                      type="button"
                      onClick={() => setDiscountType("reais")}
                      className={cn(
                        "px-2.5 py-1.5 text-xs transition duration-200",
                        discountType === "reais"
                          ? "bg-gold-dim text-gold-light"
                          : "text-textDim hover:text-text"
                      )}
                    >
                      R$
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("percent")}
                      className={cn(
                        "px-2.5 py-1.5 text-xs transition duration-200",
                        discountType === "percent"
                          ? "bg-gold-dim text-gold-light"
                          : "text-textDim hover:text-text"
                      )}
                    >
                      %
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-textDim">Acréscimo</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={surchargeValue}
                    onChange={(e) => setSurchargeValue(e.target.value)}
                    placeholder="0"
                    className="w-20 shrink-0 rounded-btn border border-border bg-surface2 px-3 py-1.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
                  />
                  <input
                    type="text"
                    value={surchargeDesc}
                    onChange={(e) => setSurchargeDesc(e.target.value)}
                    placeholder="Descrição"
                    className="w-full min-w-0 rounded-btn border border-border bg-surface2 px-3 py-1.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-textDim">Total</span>
                <span className="font-display text-2xl text-gold-light">
                  {formatCurrency(finalAmount)}
                </span>
              </div>
            </div>
          )}

          {isAdmin ? (
            <RemunerationSection
              collaboratorName={collaborator?.full_name}
              baseAmount={commissionBaseAmount}
              remunerationType={remunerationType}
              onRemunerationTypeChange={setRemunerationType}
              mode={commissionMode}
              onModeChange={setCommissionMode}
              value={commissionInputValue}
              onValueChange={setCommissionInputValue}
              computedValue={commissionValue}
              valorFixoInput={valorFixoInput}
              onValorFixoChange={setValorFixoInput}
              hint={
                remunerationType === "comissao" && defaultPercentage !== null
                  ? `Padrão da colaboradora: ${defaultPercentage}%${serviceIsChemical ? " (químico)" : ""} — ajuste se necessário`
                  : undefined
              }
            />
          ) : (
            <p className="rounded-btn bg-surface2 p-3 text-xs text-textDim">
              Sua comissão é calculada automaticamente com o seu percentual
              {serviceIsChemical ? " para serviços químicos" : ""}
              {serviceIsMega ? " sobre o valor da técnica" : ""}.
            </p>
          )}

          <div className="rounded-btn border border-border p-3">
            <Toggle
              checked={isSplitPayment}
              onChange={handleToggleSplit}
              label="Dividir pagamento"
              description="Receber em duas formas de pagamento diferentes"
            />
          </div>

          {!isSplitPayment ? (
            <div>
              <p className="mb-2 text-sm text-textDim">Selecione a forma de pagamento recebida</p>
              <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    label="Forma 1"
                    value={paymentMethod ?? ""}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  label="Valor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount1}
                  onChange={(e) => setPaymentAmount1(e.target.value)}
                  className="w-28 shrink-0"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    label="Forma 2"
                    value={paymentMethod2 ?? ""}
                    onChange={(e) => setPaymentMethod2(e.target.value as PaymentMethod)}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  label="Valor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount2}
                  onChange={(e) => setPaymentAmount2(e.target.value)}
                  className="w-28 shrink-0"
                />
              </div>
              {!splitSumMatches && (
                <p className="text-xs text-danger">A soma dos valores não corresponde ao total.</p>
              )}
            </div>
          )}

          {cashBlocked && (
            <div className="flex items-center gap-2 rounded-btn border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              <AlertCircle size={15} className="shrink-0" />
              O caixa está fechado. Abra o caixa ou selecione Promissória (sem divisão) para
              concluir sem lançar no caixa.
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setSubView("details")} className="flex-1">
              Voltar
            </Button>
            <Button
              onClick={handleConclude}
              loading={loading}
              disabled={!canConfirm}
              className="flex-1"
            >
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {subView === "package-confirm" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-btn border border-gold/30 bg-gold-dim p-4">
            <div className="flex items-center gap-2 text-sm text-gold-light">
              <Package size={16} />
              {appointment.service_name}
            </div>
            {packageInfo && (
              <p className="text-xs text-textDim">
                Sessão {Math.min(packageInfo.used_sessions + 1, packageInfo.total_sessions)} de{" "}
                {packageInfo.total_sessions} — {packageInfo.client_name}
              </p>
            )}
            <p className="text-xs text-textDim">
              Este pacote já foi pago — nenhum valor será lançado no caixa. A comissão da
              colaboradora é calculada sobre o valor desta sessão.
            </p>
          </div>

          {isAdmin ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="package-session-value" className="text-sm text-textDim">
                Valor desta sessão para comissão
              </label>
              <Input
                id="package-session-value"
                type="number"
                min="0"
                step="0.01"
                value={packageSessionValueInput}
                onChange={(e) => setPackageSessionValueInput(e.target.value)}
                placeholder="0,00"
                autoFocus
                required
              />
              <p className="text-xs text-textDim">
                Informe o valor desta sessão — a comissão da colaboradora será calculada sobre este
                valor
              </p>
            </div>
          ) : (
            <p className="rounded-btn bg-surface2 p-3 text-xs text-textDim">
              O valor desta sessão e a sua comissão são calculados automaticamente a partir do
              pacote.
            </p>
          )}

          {isAdmin && packageSessionValueNumber > 0 && (
            <RemunerationSection
              collaboratorName={collaborator?.full_name}
              baseAmount={packageSessionValueNumber}
              remunerationType={remunerationType}
              onRemunerationTypeChange={setRemunerationType}
              mode={commissionMode}
              onModeChange={setCommissionMode}
              value={commissionInputValue}
              onValueChange={setCommissionInputValue}
              computedValue={commissionValue}
              valorFixoInput={valorFixoInput}
              onValorFixoChange={setValorFixoInput}
              hint={
                remunerationType === "comissao" && defaultPercentage !== null
                  ? `Padrão da colaboradora: ${defaultPercentage}% — ajuste se necessário`
                  : undefined
              }
            />
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setSubView("details")} className="flex-1">
              Voltar
            </Button>
            <Button
              onClick={handleConcludePackage}
              loading={loading}
              disabled={!canConfirmPackage}
              className="flex-1"
            >
              <CheckCircle2 size={16} />
              Concluir Sessão
            </Button>
          </div>
        </div>
      )}

      {subView === "cancel-confirm" && (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <AlertCircle size={32} className="text-danger" />
          <p className="text-sm text-text">Tem certeza que deseja cancelar este agendamento?</p>
          <div className="flex w-full gap-3">
            <Button variant="ghost" onClick={() => setSubView("details")} className="flex-1">
              Voltar
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={loading} className="flex-1">
              Sim, cancelar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MegaInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-textDim/70">{label}</p>
      <p className="text-text">{value}</p>
    </div>
  );
}

function RemunerationSection({
  collaboratorName,
  baseAmount,
  remunerationType,
  onRemunerationTypeChange,
  mode,
  onModeChange,
  value,
  onValueChange,
  computedValue,
  valorFixoInput,
  onValorFixoChange,
  hint,
}: {
  collaboratorName?: string;
  baseAmount: number;
  remunerationType: RemunerationType;
  onRemunerationTypeChange: (type: RemunerationType) => void;
  mode: "reais" | "percent";
  onModeChange: (mode: "reais" | "percent") => void;
  value: string;
  onValueChange: (value: string) => void;
  computedValue: number;
  valorFixoInput: string;
  onValorFixoChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-btn border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">Remuneração da colaboradora</span>
        {collaboratorName && <span className="text-xs text-textDim">{collaboratorName}</span>}
      </div>

      <div className="flex overflow-hidden rounded-btn border border-border">
        <button
          type="button"
          onClick={() => onRemunerationTypeChange("comissao")}
          className={cn(
            "flex-1 px-3 py-2 text-xs font-medium transition duration-200",
            remunerationType === "comissao" ? "bg-gold-dim text-gold-light" : "text-textDim hover:text-text"
          )}
        >
          Comissão
        </button>
        <button
          type="button"
          onClick={() => onRemunerationTypeChange("valor_fixo")}
          className={cn(
            "flex-1 px-3 py-2 text-xs font-medium transition duration-200",
            remunerationType === "valor_fixo" ? "bg-gold-dim text-gold-light" : "text-textDim hover:text-text"
          )}
        >
          Valor Fixo
        </button>
      </div>

      {remunerationType === "valor_fixo" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="valor-fixo" className="text-sm text-textDim">
            Valor fixo combinado (R$)
          </label>
          <input
            id="valor-fixo"
            type="number"
            min="0"
            step="0.01"
            value={valorFixoInput}
            onChange={(e) => onValorFixoChange(e.target.value)}
            placeholder="0,00"
            required
            className="w-full rounded-btn border border-border bg-surface2 px-3 py-2 text-sm text-text outline-none transition duration-200 focus:border-gold"
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder="0"
              required
              className="w-full min-w-0 rounded-btn border border-border bg-surface2 px-3 py-2 text-sm text-text outline-none transition duration-200 focus:border-gold"
            />
            <div className="flex shrink-0 overflow-hidden rounded-btn border border-border">
              <button
                type="button"
                onClick={() => onModeChange("reais")}
                className={cn(
                  "px-3 py-2 text-xs transition duration-200",
                  mode === "reais" ? "bg-gold-dim text-gold-light" : "text-textDim hover:text-text"
                )}
              >
                R$
              </button>
              <button
                type="button"
                onClick={() => onModeChange("percent")}
                className={cn(
                  "px-3 py-2 text-xs transition duration-200",
                  mode === "percent" ? "bg-gold-dim text-gold-light" : "text-textDim hover:text-text"
                )}
              >
                %
              </button>
            </div>
          </div>
          {hint && <p className="text-xs text-gold-light">{hint}</p>}
          {mode === "percent" && (
            <p className="text-xs text-textDim">
              {value || 0}% de {formatCurrency(baseAmount)} ={" "}
              <span className="text-gold-light">{formatCurrency(computedValue)}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  Calendar,
  Gem,
  ShoppingBag,
  Clock,
  ChevronRight,
  AlertTriangle,
  ShoppingCart,
  Wallet,
  ArrowUp,
  ArrowDown,
  CalendarCheck,
  FileText,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { computeCashSummary } from "@/lib/cash";
import { PAYMENT_METHODS, PAYMENT_METHOD_COLORS } from "@/lib/constants";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  getMonday,
  addDays,
  toISODate,
  formatDay,
  parseISODate,
  isSameDay,
  formatTimeLabel,
} from "@/lib/schedule";
import type { Appointment, CashRegister, CashTransaction, Profile } from "@/lib/types/database";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function weekChangeLabel(current: number, previous: number): { text: string; up: boolean } | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { text: `${Math.abs(pct).toFixed(0)}%`, up: pct >= 0 };
}

export default function DashboardPage() {
  const [supabase] = useState(() => createClient());
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  // Starts neutral (matches SSR) and resolves to the real hour-based greeting after
  // mount — computing it directly in render risks a server/client hour-boundary mismatch.
  const [greeting, setGreeting] = useState("Olá");

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const [weekRevenue, setWeekRevenue] = useState(0);
  const [prevWeekRevenue, setPrevWeekRevenue] = useState(0);
  const [weekAppointmentsCount, setWeekAppointmentsCount] = useState(0);
  const [concludedCount, setConcludedCount] = useState(0);
  const [pendingCommissions, setPendingCommissions] = useState(0);
  const [pendingCollaboratorsCount, setPendingCollaboratorsCount] = useState(0);
  const [productsSoldCount, setProductsSoldCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [receivablesTotal, setReceivablesTotal] = useState(0);
  const [todayRegister, setTodayRegister] = useState<CashRegister | null>(null);
  const [registerTransactions, setRegisterTransactions] = useState<CashTransaction[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [collaboratorsById, setCollaboratorsById] = useState<Map<string, Profile>>(new Map());

  const monday = getMonday(new Date());
  const saturday = addDays(monday, 5);
  const prevMonday = addDays(monday, -7);
  const prevSaturday = addDays(monday, -1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const todayISO = toISODate(new Date());
      const tomorrowISO = toISODate(addDays(new Date(), 1));
      const weekStartISO = toISODate(monday);
      const weekEndExclusiveISO = toISODate(addDays(saturday, 1));
      const prevWeekStartISO = toISODate(prevMonday);
      const prevWeekEndExclusiveISO = toISODate(addDays(prevSaturday, 1));

      const [
        { data: openReg },
        { data: weekEntradas },
        { data: prevWeekEntradas },
        { count: weekApptCount },
        { count: concludedApptCount },
        { data: commissionsData },
        { data: productSalesData },
        { data: activeProducts },
        { data: upcoming },
        { count: pendingOrders },
        { data: collaborators },
        { data: receivablesData },
      ] = await Promise.all([
        supabase.from("cash_register").select("*").eq("status", "aberto").maybeSingle(),
        supabase
          .from("cash_transactions")
          .select("amount")
          .eq("type", "entrada")
          .gte("created_at", weekStartISO)
          .lt("created_at", weekEndExclusiveISO),
        supabase
          .from("cash_transactions")
          .select("amount")
          .eq("type", "entrada")
          .gte("created_at", prevWeekStartISO)
          .lt("created_at", prevWeekEndExclusiveISO),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("appointment_date", weekStartISO)
          .lte("appointment_date", toISODate(saturday)),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("appointment_date", weekStartISO)
          .lte("appointment_date", toISODate(saturday))
          .eq("status", "concluido"),
        supabase.from("commissions").select("collaborator_id, commission_value").eq("is_paid", false),
        supabase
          .from("product_sales")
          .select("quantity")
          .gte("created_at", weekStartISO)
          .lt("created_at", weekEndExclusiveISO),
        supabase.from("products").select("stock_quantity, min_stock_alert").eq("is_active", true),
        supabase
          .from("appointments")
          .select("*")
          .gte("appointment_date", todayISO)
          .eq("status", "agendado")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true })
          .limit(5),
        supabase.from("cart_orders").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase
          .from("profiles")
          .select("*")
          .or("role.eq.collaborator,and(role.eq.admin,is_also_collaborator.eq.true)"),
        supabase.from("receivables").select("remaining_amount").neq("status", "pago"),
      ]);

      setWeekRevenue(
        ((weekEntradas as { amount: number }[]) ?? []).reduce((sum, t) => sum + t.amount, 0)
      );
      setPrevWeekRevenue(
        ((prevWeekEntradas as { amount: number }[]) ?? []).reduce((sum, t) => sum + t.amount, 0)
      );
      setWeekAppointmentsCount(weekApptCount ?? 0);
      setConcludedCount(concludedApptCount ?? 0);

      const commissions = (commissionsData as { collaborator_id: string; commission_value: number }[]) ?? [];
      setPendingCommissions(commissions.reduce((sum, c) => sum + c.commission_value, 0));
      setPendingCollaboratorsCount(new Set(commissions.map((c) => c.collaborator_id)).size);

      setProductsSoldCount(
        ((productSalesData as { quantity: number }[]) ?? []).reduce((sum, s) => sum + s.quantity, 0)
      );
      setLowStockCount(
        ((activeProducts as { stock_quantity: number; min_stock_alert: number | null }[]) ?? []).filter(
          (p) => p.stock_quantity < (p.min_stock_alert ?? 5)
        ).length
      );

      let register = openReg as CashRegister | null;
      if (!register) {
        const { data: closedToday } = await supabase
          .from("cash_register")
          .select("*")
          .eq("status", "fechado")
          .gte("opened_at", todayISO)
          .lt("opened_at", tomorrowISO)
          .order("closed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        register = (closedToday as CashRegister) ?? null;
      }
      setTodayRegister(register);

      if (register) {
        const { data: txData } = await supabase
          .from("cash_transactions")
          .select("*")
          .eq("cash_register_id", register.id);
        setRegisterTransactions((txData as CashTransaction[]) ?? []);
      } else {
        setRegisterTransactions([]);
      }

      setUpcomingAppointments((upcoming as Appointment[]) ?? []);
      setPendingOrdersCount(pendingOrders ?? 0);
      setReceivablesTotal(
        ((receivablesData as { remaining_amount: number }[]) ?? []).reduce(
          (sum, r) => sum + r.remaining_amount,
          0
        )
      );
      setCollaboratorsById(new Map(((collaborators as Profile[]) ?? []).map((c) => [c.id, c])));
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const summary = todayRegister ? computeCashSummary(registerTransactions, todayRegister.opening_amount) : null;
  const revenueChange = weekChangeLabel(weekRevenue, prevWeekRevenue);
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  const cashClosedToday = !loading && !todayRegister;
  const hasAlerts =
    cashClosedToday || lowStockCount > 0 || pendingOrdersCount > 0 || receivablesTotal > 0;

  const stats = [
    {
      label: "Faturamento da Semana",
      value: formatCurrency(weekRevenue),
      icon: DollarSign,
      subtext: revenueChange && (
        <span className={cn("flex items-center gap-1", revenueChange.up ? "text-success" : "text-danger")}>
          {revenueChange.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {revenueChange.text} vs. semana anterior
        </span>
      ),
    },
    {
      label: "Agendamentos",
      value: String(weekAppointmentsCount),
      icon: Calendar,
      subtext: <span>{concludedCount} concluídos</span>,
    },
    {
      label: "Comissões Pendentes",
      value: formatCurrency(pendingCommissions),
      icon: Gem,
      subtext: (
        <span>
          {pendingCollaboratorsCount} colaboradora{pendingCollaboratorsCount === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      label: "Produtos Vendidos",
      value: String(productsSoldCount),
      icon: ShoppingBag,
      subtext: (
        <span className={lowStockCount > 0 ? "text-danger" : undefined}>
          {lowStockCount} item{lowStockCount === 1 ? "" : "s"} com estoque baixo
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ""}`}
        subtitle={`Semana ${formatDay(monday)} — ${String(saturday.getDate()).padStart(2, "0")}/${String(
          saturday.getMonth() + 1
        ).padStart(2, "0")}/${saturday.getFullYear()}`}
      />

      {!loading && hasAlerts && (
        <div className="mb-6 flex flex-col gap-2">
          {cashClosedToday && (
            <Card className="flex items-center justify-between border-danger/30 bg-danger/10">
              <div className="flex items-center gap-3">
                <Wallet size={18} className="text-danger" strokeWidth={1.75} />
                <p className="text-sm text-danger">O caixa ainda não foi aberto hoje</p>
              </div>
              <Badge tone="danger">Caixa fechado</Badge>
            </Card>
          )}
          {lowStockCount > 0 && (
            <Link href="/admin/estoque">
              <Card className="flex items-center justify-between border-danger/30 bg-danger/10 transition duration-200 hover:border-danger">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-danger" strokeWidth={1.75} />
                  <p className="text-sm text-danger">
                    {lowStockCount} produto{lowStockCount === 1 ? "" : "s"} com estoque baixo
                  </p>
                </div>
                <ChevronRight size={18} className="text-danger" />
              </Card>
            </Link>
          )}
          {pendingOrdersCount > 0 && (
            <Link href="/admin/produtos">
              <Card className="flex items-center justify-between border-gold/30 bg-gold-dim transition duration-200 hover:border-gold">
                <div className="flex items-center gap-3">
                  <ShoppingCart size={18} className="text-gold" strokeWidth={1.75} />
                  <p className="text-sm text-gold-light">
                    {pendingOrdersCount} pedido{pendingOrdersCount === 1 ? "" : "s"} aguardando confirmação
                  </p>
                </div>
                <ChevronRight size={18} className="text-gold-light" />
              </Card>
            </Link>
          )}
          {receivablesTotal > 0 && (
            <Link href="/admin/relatorios-caixa">
              <Card className="flex items-center justify-between border-warn/30 bg-warn/10 transition duration-200 hover:border-warn">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-warn" strokeWidth={1.75} />
                  <p className="text-sm text-warn">
                    A Receber: {formatCurrency(receivablesTotal)} — Ver detalhes
                  </p>
                </div>
                <ChevronRight size={18} className="text-warn" />
              </Card>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, subtext }) => (
          <Card key={label} className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-dim">
              <Icon size={20} className="text-gold" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-textDim">{label}</p>
              <p className="mt-1 font-display text-xl text-text">{loading ? "—" : value}</p>
              {!loading && <div className="mt-0.5 text-[11px] text-textDim">{subtext}</div>}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg text-text">Caixa por Forma de Pagamento</h2>
          <Link
            href="/admin/caixa"
            className="flex items-center gap-1 text-xs text-gold transition duration-200 hover:text-gold-light"
          >
            Ver completo <ChevronRight size={14} />
          </Link>
        </div>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : !summary || summary.totalEntries === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Wallet size={24} className="text-textDim" strokeWidth={1.5} />
            <p className="text-sm text-textDim">Nenhuma movimentação registrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => {
              const color = PAYMENT_METHOD_COLORS[value];
              const data = summary.paymentTotals[value];
              const pct = summary.totalEntries > 0 ? (data.total / summary.totalEntries) * 100 : 0;
              return (
                <div key={value} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Icon size={15} style={{ color }} strokeWidth={1.75} />
                    <span className="text-xs text-textDim">{label}</span>
                  </div>
                  <p className="font-display text-lg text-text">{formatCurrency(data.total)}</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <p className="text-[11px] text-textDim">{pct.toFixed(0)}%</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg text-text">Próximos agendamentos</h2>
          <Link
            href="/admin/agendamentos"
            className="flex items-center gap-1 text-xs text-gold transition duration-200 hover:text-gold-light"
          >
            Ver todos <ChevronRight size={14} />
          </Link>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : upcomingAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <CalendarCheck size={26} className="text-textDim" strokeWidth={1.5} />
            <p className="text-sm text-textDim">Nenhum agendamento pendente</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingAppointments.map((appt) => {
              const collaborator = appt.collaborator_id ? collaboratorsById.get(appt.collaborator_id) : null;
              const date = parseISODate(appt.appointment_date);
              const dayLabel = isSameDay(date, new Date()) ? "Hoje" : formatDate(date);
              return (
                <div key={appt.id} className="flex items-center gap-3 rounded-btn border border-border p-3">
                  <CollaboratorAvatar
                    name={collaborator?.full_name ?? "?"}
                    color={collaborator?.avatar_color}
                    photoUrl={collaborator?.photo_url}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text">{appt.client_name}</p>
                    <p className="truncate text-xs text-textDim">{appt.service_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1.5 text-sm text-gold">
                      <Clock size={13} />
                      {formatTimeLabel(appt.appointment_time)}
                    </div>
                    <p className="text-[11px] text-textDim">{dayLabel}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

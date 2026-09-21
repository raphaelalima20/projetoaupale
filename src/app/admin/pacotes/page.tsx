"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Package, CheckCircle2, DollarSign } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import PackageCard from "@/components/packages/PackageCard";
import SellPackageModal from "@/components/packages/SellPackageModal";
import { createClient } from "@/lib/supabase/client";
import { useServices } from "@/lib/hooks/useServices";
import { formatCurrency, cn } from "@/lib/utils";
import { toISODate } from "@/lib/schedule";
import type { ClientPackage, Profile } from "@/lib/types/database";

type FilterTab = "ativos" | "concluidos" | "todos";

export default function PacotesPage() {
  const [supabase] = useState(() => createClient());
  const { services } = useServices();
  const packageServices = useMemo(() => services.filter((s) => s.type === "pacote"), [services]);

  const [packages, setPackages] = useState<ClientPackage[]>([]);
  const [collaboratorsById, setCollaboratorsById] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("ativos");
  const [modalOpen, setModalOpen] = useState(false);

  async function fetchPackages() {
    setLoading(true);
    const [{ data: pkgData }, { data: collabData }] = await Promise.all([
      supabase.from("client_packages").select("*").order("purchased_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "collaborator"),
    ]);
    setPackages((pkgData as ClientPackage[]) ?? []);
    setCollaboratorsById(new Map(((collabData as Profile[]) ?? []).map((c) => [c.id, c])));
    setLoading(false);
  }

  useEffect(() => {
    fetchPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthStartISO = useMemo(() => {
    const now = new Date();
    return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  const activeCount = packages.filter((p) => p.status === "ativo").length;
  const concludedThisMonth = packages.filter(
    (p) => p.status === "concluido" && toISODate(new Date(p.purchased_at)) >= monthStartISO
  );
  const revenueThisMonth = packages
    .filter((p) => toISODate(new Date(p.purchased_at)) >= monthStartISO)
    .reduce((sum, p) => sum + p.total_price, 0);

  const filtered = packages.filter((p) => {
    if (tab === "ativos") return p.status === "ativo";
    if (tab === "concluidos") return p.status === "concluido";
    return true;
  });

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Pacotes Mensais"
        subtitle="Controle de pacotes ativos"
        actions={
          <Button onClick={() => setModalOpen(true)} disabled={packageServices.length === 0}>
            <Plus size={16} />
            Vender Pacote
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-dim">
            <Package size={20} className="text-gold" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-textDim">Pacotes Ativos</p>
            <p className="mt-1 font-display text-xl text-text">{loading ? "—" : activeCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-dim">
            <CheckCircle2 size={20} className="text-gold" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-textDim">Pacotes Concluídos (mês)</p>
            <p className="mt-1 font-display text-xl text-text">
              {loading ? "—" : concludedThisMonth.length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-dim">
            <DollarSign size={20} className="text-gold" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-textDim">Receita de Pacotes (mês)</p>
            <p className="mt-1 font-display text-xl text-text">
              {loading ? "—" : formatCurrency(revenueThisMonth)}
            </p>
          </div>
        </Card>
      </div>

      <div className="mb-4 flex gap-2">
        {(
          [
            { value: "ativos", label: "Ativos" },
            { value: "concluidos", label: "Concluídos" },
            { value: "todos", label: "Todos" },
          ] as { value: FilterTab; label: string }[]
        ).map((f) => (
          <button
            key={f.value}
            onClick={() => setTab(f.value)}
            className={cn(
              "rounded-btn border px-4 py-2 text-sm transition duration-200",
              tab === f.value
                ? "border-gold bg-gold-dim text-gold-light"
                : "border-border text-textDim hover:border-gold/50 hover:text-text"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Package size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Nenhum pacote encontrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} collaboratorsById={collaboratorsById} />
          ))}
        </div>
      )}

      <SellPackageModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSold={fetchPackages}
        packageServices={packageServices}
      />
    </div>
  );
}

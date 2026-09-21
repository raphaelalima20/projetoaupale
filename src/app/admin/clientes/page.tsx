"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, UserRound, Cake } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import ClientFormModal from "@/components/clients/ClientFormModal";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatPhone } from "@/lib/utils";
import { parseISODate } from "@/lib/schedule";
import type { Client } from "@/lib/types/database";

type SortOption = "name" | "recent";

export default function ClientesPage() {
  const [supabase] = useState(() => createClient());
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  async function fetchClients() {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*");
    setClients((data as Client[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = clients;
    if (term) {
      const digits = term.replace(/\D/g, "");
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) || (digits && c.phone.includes(digits))
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [clients, search, sort]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setModalOpen(true);
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Clientes"
        subtitle={loading ? "Gerencie a base de clientes" : `${clients.length} clientes cadastrados`}
        actions={
          <Button onClick={openNew}>
            <Plus size={16} />
            Novo Cliente
          </Button>
        }
      />

      <Card className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textDim"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full rounded-btn border border-border bg-surface2 py-2.5 pl-9 pr-4 text-sm text-text outline-none transition duration-200 focus:border-gold"
          />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
          <option value="name">Nome (A-Z)</option>
          <option value="recent">Mais recentes</option>
        </Select>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <UserRound size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Nenhum cliente encontrado</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((c) => (
            <Card key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{c.name}</p>
                <p className="text-xs text-textDim">
                  {formatPhone(c.phone)} · Cadastrado em {formatDate(new Date(c.created_at))}
                </p>
                <p className="flex items-center gap-1 text-xs text-textDim">
                  <Cake size={12} className={c.data_nascimento ? "text-gold" : undefined} />
                  {c.data_nascimento
                    ? `Nascimento: ${formatDate(parseISODate(c.data_nascimento))}`
                    : "Nascimento não informado"}
                </p>
              </div>
              <button
                onClick={() => openEdit(c)}
                className="shrink-0 rounded-btn p-1.5 text-textDim transition duration-200 hover:bg-surface2 hover:text-text"
              >
                <Pencil size={15} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <ClientFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchClients}
        client={editing}
      />
    </div>
  );
}

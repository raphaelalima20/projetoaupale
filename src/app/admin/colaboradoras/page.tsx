"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, CalendarOff } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import CollaboratorFormModal from "@/components/collaborators/CollaboratorFormModal";
import SpecialtyText from "@/components/collaborators/SpecialtyText";
import ScheduleBlockModal from "@/components/collaborators/ScheduleBlockModal";
import ScheduleBlockCard from "@/components/collaborators/ScheduleBlockCard";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useScheduleBlocks } from "@/lib/hooks/useScheduleBlocks";
import { toISODate } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

type BlockFilter = "active" | "all";

export default function ColaboradorasPage() {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const { blocks, loading: loadingBlocks, refetch: refetchBlocks } = useScheduleBlocks({ admin: true });
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockFilter, setBlockFilter] = useState<BlockFilter>("active");
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

  async function fetchCollaborators() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });
    setCollaborators((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchCollaborators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(c: Profile) {
    setEditing(c);
    setModalOpen(true);
  }

  function collaboratorFor(id: string) {
    return collaborators.find((c) => c.id === id);
  }

  const activeCollaborators = collaborators.filter(
    (c) => c.role === "collaborator" && c.is_active
  );

  const todayISO = toISODate(new Date());
  const filteredBlocks = (
    blockFilter === "active" ? blocks.filter((b) => b.end_date >= todayISO) : blocks
  ).sort((a, b) => a.start_date.localeCompare(b.start_date));

  async function handleRemoveBlock(id: string) {
    setRemovingBlockId(id);
    const { error } = await supabase.from("schedule_blocks").delete().eq("id", id);
    setRemovingBlockId(null);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Bloqueio removido");
    refetchBlocks();
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Colaboradoras"
        subtitle="Gerencie a equipe do salão"
        actions={
          <Button onClick={openNew}>
            <Plus size={16} />
            Nova Colaboradora
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : collaborators.length === 0 ? (
        <Card className="py-16 text-center text-sm text-textDim">
          Nenhuma colaboradora cadastrada
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collaborators.map((c) => (
            <Card key={c.id} className="flex items-center gap-3">
              <CollaboratorAvatar
                name={c.full_name}
                color={c.avatar_color}
                photoUrl={c.photo_url}
                size={48}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-text">{c.full_name}</p>
                  {c.role === "admin" && <Badge tone="gold">Admin</Badge>}
                </div>
                <div className="flex min-w-0 items-center gap-1 text-xs text-textDim">
                  {c.role === "admin" ? (
                    <span>Administradora</span>
                  ) : (
                    <SpecialtyText specialty={c.specialty} />
                  )}
                  {c.role === "collaborator" && (
                    <span className="shrink-0">· Comissão: {c.commission_percentage}%</span>
                  )}
                </div>
                <Badge tone={c.is_active ? "success" : "danger"} className="mt-1.5">
                  {c.is_active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <button
                onClick={() => openEdit(c)}
                className="rounded-btn p-1.5 text-textDim transition duration-200 hover:bg-surface2 hover:text-text"
              >
                <Pencil size={15} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10">
        <PageHeader
          title="Fluxo de Agenda"
          subtitle="Gerencie folgas e indisponibilidades"
          actions={
            <Button
              onClick={() => setBlockModalOpen(true)}
              disabled={activeCollaborators.length === 0}
            >
              <Plus size={16} />
              Novo Bloqueio
            </Button>
          }
        />

        <div className="mb-4 flex gap-2">
          {(["active", "all"] as BlockFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setBlockFilter(f)}
              className={cn(
                "rounded-badge border px-3.5 py-1.5 text-xs font-medium transition duration-200",
                blockFilter === f
                  ? "border-gold bg-gold-dim text-gold-light"
                  : "border-border text-textDim hover:border-gold/40 hover:text-text"
              )}
            >
              {f === "active" ? "Ativos" : "Todos"}
            </button>
          ))}
        </div>

        {loadingBlocks ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : filteredBlocks.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-14 text-center">
            <CalendarOff size={26} className="text-textDim" strokeWidth={1.5} />
            <p className="text-sm text-textDim">Nenhuma indisponibilidade cadastrada</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredBlocks.map((b) => (
              <ScheduleBlockCard
                key={b.id}
                block={b}
                collaborator={collaboratorFor(b.collaborator_id)}
                onRemove={() => handleRemoveBlock(b.id)}
                removing={removingBlockId === b.id}
              />
            ))}
          </div>
        )}
      </div>

      <CollaboratorFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchCollaborators}
        collaborator={editing}
      />

      <ScheduleBlockModal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onSaved={refetchBlocks}
        collaborators={activeCollaborators}
      />
    </div>
  );
}

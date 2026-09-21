"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarOff } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { toISODate } from "@/lib/schedule";
import type { Profile } from "@/lib/types/database";

interface ScheduleBlockModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  collaborators: Profile[];
}

const MISSING_COLUMN_MESSAGE =
  "O banco de dados ainda não foi atualizado para este recurso. Peça para rodar a migração SQL (ALTER TABLE schedule_blocks ADD COLUMN start_time TIME DEFAULT '08:00', ADD COLUMN end_time TIME DEFAULT '19:00') antes de cadastrar bloqueios.";

export default function ScheduleBlockModal({
  open,
  onClose,
  onSaved,
  collaborators,
}: ScheduleBlockModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile } = useAuth();

  const [collaboratorId, setCollaboratorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = toISODate(new Date());
    setCollaboratorId(collaborators[0]?.id ?? "");
    setStartDate(today);
    setEndDate(today);
    setEndTime("");
    setReason("");
    setError("");
  }, [open, collaborators]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!collaboratorId) return setError("Selecione uma colaboradora.");
    if (!startDate || !endDate) return setError("Informe o período do bloqueio.");
    if (endDate < startDate) return setError("A data fim não pode ser anterior à data início.");

    setLoading(true);
    const { error: insertError } = await supabase.from("schedule_blocks").insert({
      collaborator_id: collaboratorId,
      start_date: startDate,
      end_date: endDate,
      end_time: endTime.trim() || null,
      block_type: "full_day",
      reason: reason.trim() || null,
      created_by: profile?.id ?? null,
    });

    setLoading(false);
    if (insertError) {
      if (insertError.code === "PGRST204" || /end_time|start_time/i.test(insertError.message)) {
        setError(MISSING_COLUMN_MESSAGE);
      } else {
        setError(insertError.message);
      }
      return;
    }
    showToast("Bloqueio cadastrado");
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Bloqueio">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Colaboradora"
          value={collaboratorId}
          onChange={(e) => setCollaboratorId(e.target.value)}
          required
        >
          <option value="" disabled>
            Selecione uma colaboradora
          </option>
          {collaborators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data início"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            label="Data fim"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="block-end-time" className="text-sm text-textDim">
            Disponível a partir de (último dia)
          </label>
          <Input
            id="block-end-time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <p className="text-xs text-textDim">
            A colaboradora volta a ficar ativa neste horário no último dia do bloqueio. Deixe em
            branco para bloquear o dia inteiro.
          </p>
        </div>

        <Input
          label="Motivo"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex: Folga, Férias, Consulta médica"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} className="mt-2 w-full">
          <CalendarOff size={16} />
          Salvar bloqueio
        </Button>
      </form>
    </Modal>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, UserPlus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PhoneInput from "@/components/ui/PhoneInput";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { toISODate } from "@/lib/schedule";
import type { Client } from "@/lib/types/database";

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  client: Client | null;
}

/**
 * Manual registration and editing (admin only). Birth date is shown for every client — including
 * the ones saved automatically from a booking — and stays empty/editable until the admin fills it.
 */
export default function ClientFormModal({ open, onClose, onSaved, client }: ClientFormModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (client) {
      setName(client.name);
      setPhone(client.phone.replace(/\D/g, ""));
      setBirthDate(client.data_nascimento ?? "");
    } else {
      setName("");
      setPhone("");
      setBirthDate("");
    }
  }, [open, client]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Informe o nome.");
      return;
    }
    if (phone.length < 10) {
      setError("Informe um telefone válido.");
      return;
    }
    if (birthDate && (birthDate > toISODate(new Date()) || birthDate < "1900-01-01")) {
      setError("Informe uma data de nascimento válida.");
      return;
    }

    const payload = {
      name: name.trim(),
      phone,
      data_nascimento: birthDate || null,
    };

    setLoading(true);
    const { error: saveError } = client
      ? await supabase.from("clients").update(payload).eq("id", client.id)
      : await supabase.from("clients").insert(payload);

    setLoading(false);
    if (saveError) {
      if (saveError.code === "23505") {
        setError("Cliente já cadastrado com este telefone.");
      } else {
        setError(saveError.message);
      }
      return;
    }

    showToast(client ? "Cliente atualizado" : "Cliente cadastrado");
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={client ? "Editar Cliente" : "Novo Cliente"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <PhoneInput value={phone} onChange={setPhone} required />
        <div className="flex flex-col gap-1.5">
          <Input
            id="birth-date"
            label="Data de nascimento"
            type="date"
            value={birthDate}
            min="1900-01-01"
            max={toISODate(new Date())}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <p className="text-xs text-textDim">
            Opcional. Usada para enviar a mensagem de aniversário pelo WhatsApp.
          </p>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="mt-2 w-full">
          {client ? <Save size={16} /> : <UserPlus size={16} />}
          Salvar
        </Button>
      </form>
    </Modal>
  );
}

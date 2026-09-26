"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, Copy, Check, UserPlus, Send, Plus, X, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PhoneInput from "@/components/ui/PhoneInput";
import CpfInput from "@/components/ui/CpfInput";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import ImageUpload from "@/components/products/ImageUpload";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { AVATAR_COLORS, SPECIALTY_OPTIONS } from "@/lib/constants";
import { parseSpecialties } from "@/lib/specialties";
import { cn } from "@/lib/utils";
import type { Profile, UserRole } from "@/lib/types/database";

interface SpecialtyRow {
  id: string;
  /** One of SPECIALTY_OPTIONS, "Outro", or "" (unselected). */
  value: string;
  customText: string;
}

function emptyRow(): SpecialtyRow {
  return { id: crypto.randomUUID(), value: "", customText: "" };
}

/** Empty input = 0; clamps to the 0–100 range the database enforces. */
function pct(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

function rowsFromSpecialty(specialty: string | null | undefined): SpecialtyRow[] {
  const parsed = parseSpecialties(specialty);
  if (parsed.length === 0) return [emptyRow()];
  return parsed.map((s) =>
    SPECIALTY_OPTIONS.includes(s)
      ? { id: crypto.randomUUID(), value: s, customText: "" }
      : { id: crypto.randomUUID(), value: "Outro", customText: s }
  );
}

interface CollaboratorFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  collaborator: Profile | null;
}

export default function CollaboratorFormModal({
  open,
  onClose,
  onSaved,
  collaborator,
}: CollaboratorFormModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile: currentProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [address, setAddress] = useState("");
  const [specialtyRows, setSpecialtyRows] = useState<SpecialtyRow[]>([emptyRow()]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0].value);
  const [role, setRole] = useState<UserRole>("collaborator");
  const [commissionPct, setCommissionPct] = useState("");
  const [commissionChemicalPct, setCommissionChemicalPct] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const isSelf = !!collaborator && collaborator.id === currentProfile?.id;

  useEffect(() => {
    if (!open) return;
    setInviteLink(null);
    setCopied(false);
    setError("");
    setConfirmingDelete(false);
    setDeleting(false);
    setDeleteError("");
    if (collaborator) {
      setFullName(collaborator.full_name);
      setEmail(collaborator.email ?? "");
      setPhone((collaborator.phone ?? "").replace(/\D/g, ""));
      setCpf((collaborator.cpf ?? "").replace(/\D/g, ""));
      setAddress(collaborator.address ?? "");
      setSpecialtyRows(rowsFromSpecialty(collaborator.specialty));
      setPhotoFile(null);
      setPhotoPreviewUrl(collaborator.photo_url ?? null);
      setAvatarColor(collaborator.avatar_color ?? AVATAR_COLORS[0].value);
      setRole(collaborator.role);
      setCommissionPct(String(collaborator.commission_percentage ?? 0));
      setCommissionChemicalPct(String(collaborator.commission_chemical_percentage ?? 0));
    } else {
      setFullName("");
      setEmail("");
      setPhone("");
      setCpf("");
      setAddress("");
      setSpecialtyRows([emptyRow()]);
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setAvatarColor(AVATAR_COLORS[0].value);
      setRole("collaborator");
      setCommissionPct("");
      setCommissionChemicalPct("");
    }
  }, [open, collaborator]);

  function addSpecialtyRow() {
    setSpecialtyRows((prev) => [...prev, emptyRow()]);
  }

  function removeSpecialtyRow(id: string) {
    setSpecialtyRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function updateSpecialtyRow(id: string, patch: Partial<Pick<SpecialtyRow, "value" | "customText">>) {
    setSpecialtyRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSelectPhoto(file: File) {
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemovePhoto() {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) {
      setError("Informe o nome completo.");
      return;
    }
    if (!collaborator && !email.trim()) {
      setError("Informe o e-mail.");
      return;
    }
    const finalSpecialty = specialtyRows
      .map((r) => (r.value === "Outro" ? r.customText.trim() : r.value))
      .filter(Boolean)
      .join(", ");
    if (!finalSpecialty) {
      setError("Selecione ao menos uma especialidade.");
      return;
    }

    setLoading(true);

    if (collaborator) {
      let photoUrl = collaborator.photo_url;
      if (photoFile) {
        try {
          photoUrl = await uploadImage(supabase, "salon", photoFile, `collaborators/${collaborator.id}`);
        } catch (uploadErr) {
          setError(uploadErr instanceof Error ? uploadErr.message : "Falha ao enviar a foto.");
          setLoading(false);
          return;
        }
      } else if (photoPreviewUrl === null) {
        photoUrl = null;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone || null,
          cpf: cpf || null,
          address: address || null,
          specialty: finalSpecialty,
          photo_url: photoUrl,
          avatar_color: avatarColor,
          role: isSelf ? collaborator.role : role,
          is_also_collaborator: (isSelf ? collaborator.role : role) === "admin" && collaborator.is_also_collaborator,
          commission_percentage: pct(commissionPct),
          commission_chemical_percentage: pct(commissionChemicalPct),
        })
        .eq("id", collaborator.id);

      setLoading(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      showToast("Colaboradora atualizada");
      onSaved();
      onClose();
      return;
    }

    const res = await fetch("/api/collaborators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        cpf,
        address,
        specialty: finalSpecialty,
        avatarColor,
        commissionPercentage: pct(commissionPct),
        commissionChemicalPercentage: pct(commissionChemicalPct),
      }),
    });
    const body = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(body.error ?? "Não foi possível cadastrar a colaboradora.");
      return;
    }

    if (photoFile && body.id) {
      try {
        const photoUrl = await uploadImage(supabase, "salon", photoFile, `collaborators/${body.id}`);
        await supabase.from("profiles").update({ photo_url: photoUrl }).eq("id", body.id);
      } catch {
        // Photo upload failing shouldn't block the invite flow — admin can add it later via edit.
      }
    }

    setLoading(false);
    showToast("Colaboradora cadastrada");
    onSaved();
    setInviteLink(body.inviteLink);
  }

  async function handleToggleActive() {
    if (!collaborator) return;
    setLoading(true);
    const { error: toggleError } = await supabase
      .from("profiles")
      .update({ is_active: !collaborator.is_active })
      .eq("id", collaborator.id);
    setLoading(false);
    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    showToast(collaborator.is_active ? "Colaboradora desativada" : "Colaboradora reativada");
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!collaborator) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/collaborators/${collaborator.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(body.error ?? "Não foi possível excluir a colaboradora.");
      return;
    }
    showToast("Colaboradora excluída");
    onSaved();
    onClose();
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleResendInvite() {
    if (!collaborator) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/collaborators/resend-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId: collaborator.id }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Não foi possível reenviar o convite.");
      return;
    }
    setInviteLink(body.inviteLink);
  }

  if (inviteLink) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={collaborator ? "Convite reenviado" : "Colaboradora cadastrada"}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-textDim">
            Envie este link para {fullName} definir a senha e acessar o sistema.
          </p>
          <div className="break-all rounded-btn border border-border bg-surface2 p-3 text-xs text-text">
            {inviteLink}
          </div>
          <Button onClick={copyLink} variant="secondary" className="w-full">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
          <Button onClick={onClose} className="w-full">
            Concluir
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={collaborator ? "Editar Colaboradora" : "Nova Colaboradora"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex justify-center">
          <ImageUpload
            previewUrl={photoPreviewUrl}
            onSelect={handleSelectPhoto}
            onRemove={handleRemovePhoto}
            label=""
            alt={fullName || "Foto"}
            size={80}
            rounded="full"
          />
        </div>

        <Input
          label="Nome completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoFocus
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm text-textDim">Especialidades</span>
          {specialtyRows.map((row) => (
            <div key={row.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select
                    value={row.value}
                    onChange={(e) => updateSpecialtyRow(row.id, { value: e.target.value })}
                    required
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {SPECIALTY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value="Outro">Outro</option>
                  </Select>
                </div>
                {specialtyRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSpecialtyRow(row.id)}
                    aria-label="Remover especialidade"
                    className="shrink-0 rounded-btn p-2 text-textDim transition duration-200 hover:bg-surface2 hover:text-danger"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {row.value === "Outro" && (
                <Input
                  value={row.customText}
                  onChange={(e) => updateSpecialtyRow(row.id, { customText: e.target.value })}
                  placeholder="Digite a especialidade"
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addSpecialtyRow}
            className="flex items-center gap-1.5 self-start text-xs text-gold transition duration-200 hover:text-gold-light"
          >
            <Plus size={14} />
            Adicionar especialidade
          </button>
        </div>

        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={!collaborator}
          disabled={!!collaborator}
        />
        <PhoneInput value={phone} onChange={setPhone} />
        <CpfInput value={cpf} onChange={setCpf} />
        <Input label="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-textDim">Cor do avatar</span>
          <div className="flex gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setAvatarColor(c.value)}
                aria-label={c.label}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition duration-200",
                  avatarColor === c.value ? "scale-110 border-text" : "border-transparent"
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-textDim">Comissão da colaboradora</span>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Normal (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Químico (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={commissionChemicalPct}
              onChange={(e) => setCommissionChemicalPct(e.target.value)}
              placeholder="0"
            />
          </div>
          <p className="text-xs text-textDim">
            A comissão normal vale para os serviços em geral; a de químico, para serviços marcados
            como &quot;químico&quot;. Ao concluir um atendimento a comissão já vem calculada.
          </p>
        </div>

        {collaborator && (
          <div className="rounded-btn border border-border p-3">
            <Toggle
              checked={role === "admin"}
              onChange={(checked) => setRole(checked ? "admin" : "collaborator")}
              disabled={isSelf}
              label="Acesso Administrador"
              description={
                isSelf
                  ? "Você não pode alterar seu próprio acesso"
                  : role === "admin"
                    ? "Vê o menu completo de administração"
                    : "Acesso restrito à agenda e comissões"
              }
            />
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} className="mt-2 w-full">
          {collaborator ? <Save size={16} /> : <UserPlus size={16} />}
          {collaborator ? "Salvar" : "Cadastrar e gerar convite"}
        </Button>

        {collaborator && collaborator.role === "collaborator" && !collaborator.invite_accepted && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleResendInvite}
            disabled={loading}
            className="w-full"
          >
            <Send size={16} />
            Reenviar convite
          </Button>
        )}

        {collaborator?.is_also_collaborator && (
          <p className="rounded-btn border border-border bg-surface2 p-3 text-xs text-textDim">
            Admin que também atende. Para ativar/desativar como profissional, use{" "}
            <span className="text-text">Configurações → Perfil profissional</span>.
          </p>
        )}

        {collaborator && !collaborator.is_also_collaborator && (
          <Button
            type="button"
            variant={collaborator.is_active ? "danger" : "secondary"}
            onClick={handleToggleActive}
            disabled={loading}
            className="w-full"
          >
            {collaborator.is_active ? "Desativar colaboradora" : "Reativar colaboradora"}
          </Button>
        )}

        {collaborator && !isSelf && collaborator.role === "collaborator" && (
          <div className="border-t border-border pt-4">
            {confirmingDelete ? (
              <div className="flex flex-col gap-3 rounded-btn border border-danger/30 bg-danger/10 p-3">
                <p className="text-sm text-danger">
                  Tem certeza que deseja excluir esta colaboradora? Esta ação não pode ser desfeita.
                </p>
                {deleteError && <p className="text-xs text-danger">{deleteError}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDelete}
                    loading={deleting}
                    className="flex-1"
                  >
                    Confirmar exclusão
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setConfirmingDelete(true);
                }}
                disabled={loading}
                className="w-full"
              >
                <Trash2 size={16} />
                Excluir colaboradora
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

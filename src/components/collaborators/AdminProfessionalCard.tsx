"use client";

import { useEffect, useState } from "react";
import { Save, Scissors } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { SPECIALTY_OPTIONS } from "@/lib/constants";
import { parseSpecialties } from "@/lib/specialties";
import { cn } from "@/lib/utils";

function pct(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

/**
 * Exceção configurável: a admin também atende. Liga a flag profiles.is_also_collaborator, que
 * faz o próprio perfil aparecer na agenda, no agendamento (público e manual) e nas comissões.
 * Desligar só esconde — o histórico (agendamentos, comissões, vales) continua intacto.
 */
export default function AdminProfessionalCard() {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile, refreshProfile } = useAuth();

  const [enabled, setEnabled] = useState(false);
  const [commissionPct, setCommissionPct] = useState("0");
  const [chemicalPct, setChemicalPct] = useState("0");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setEnabled(profile.is_also_collaborator ?? false);
    setCommissionPct(String(profile.commission_percentage ?? 0));
    setChemicalPct(String(profile.commission_chemical_percentage ?? 0));
    setSpecialties(parseSpecialties(profile.specialty));
  }, [profile]);

  if (!profile || profile.role !== "admin") return null;

  function toggleSpecialty(name: string) {
    setSpecialties((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const payload: Record<string, unknown> = { is_also_collaborator: enabled };
    if (enabled) {
      payload.commission_percentage = pct(commissionPct);
      payload.commission_chemical_percentage = pct(chemicalPct);
      payload.specialty = specialties.length > 0 ? specialties.join(", ") : null;
    }
    const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
    setSaving(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    await refreshProfile();
    showToast(enabled ? "Você agora aparece como profissional" : "Você não aparece mais como profissional");
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Scissors size={18} className="text-gold" strokeWidth={1.75} />
        <h2 className="font-display text-lg text-text">Perfil profissional</h2>
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-btn border border-border p-3">
          <Toggle
            checked={enabled}
            onChange={setEnabled}
            label="Também atendo como profissional"
            description="Você aparece na agenda e no agendamento (cliente e manual) e recebe comissões. Ao desativar, o histórico é preservado."
          />
        </div>

        {enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Comissão normal (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
              />
              <Input
                label="Comissão químico (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={chemicalPct}
                onChange={(e) => setChemicalPct(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-textDim">Especialidades que atende</span>
              <div className="flex flex-wrap gap-2">
                {SPECIALTY_OPTIONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleSpecialty(name)}
                    className={cn(
                      "rounded-badge border px-3 py-1.5 text-xs transition duration-200",
                      specialties.includes(name)
                        ? "border-gold bg-gold-dim text-gold-light"
                        : "border-border text-textDim hover:border-gold/50 hover:text-text"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-textDim">
              Nome, telefone e foto são os do seu perfil — edite em Colaboradoras → seu cadastro.
            </p>
          </>
        )}

        <Button onClick={handleSave} loading={saving} className="w-full sm:w-auto sm:self-end">
          <Save size={16} />
          Salvar perfil profissional
        </Button>
      </div>
    </Card>
  );
}

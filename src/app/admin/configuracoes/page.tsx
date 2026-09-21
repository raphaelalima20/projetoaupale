"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, Store, QrCode, CreditCard, Clock, UserCircle, KeyRound } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import Skeleton from "@/components/ui/Skeleton";
import PasswordInput from "@/components/ui/PasswordInput";
import ImageUpload from "@/components/products/ImageUpload";
import WhatsappSettings from "@/components/whatsapp/WhatsappSettings";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { uploadImage } from "@/lib/storage";
import type { SalonSettings } from "@/lib/types/database";

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

export default function ConfiguracoesPage() {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("19:00");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixBeneficiary, setPixBeneficiary] = useState("");
  const [city, setCity] = useState("SAO PAULO");
  const [mpEnabled, setMpEnabled] = useState(false);
  const [mpToken, setMpToken] = useState("");
  const [mpLink, setMpLink] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from("salon_settings").select("*").maybeSingle();
      const row = data as SalonSettings | null;
      setSettings(row);
      if (row) {
        setName(row.name ?? "");
        setSubtitle(row.subtitle ?? "");
        setPhone(row.phone ?? "");
        setAddress(row.address ?? "");
        setOpeningTime((row.opening_time ?? "08:00:00").slice(0, 5));
        setClosingTime((row.closing_time ?? "19:00:00").slice(0, 5));
        setLogoPreview(row.logo_url ?? null);
        setPixKey(row.pix_key ?? "");
        setPixKeyType(row.pix_key_type ?? "cpf");
        setPixBeneficiary(row.pix_beneficiary ?? "");
        setCity(row.city ?? "SAO PAULO");
        setMpEnabled(row.mercado_pago_enabled ?? false);
        setMpToken(row.mercado_pago_token ?? "");
        setMpLink(row.mercado_pago_link ?? "");
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  function handleSelectLogo(file: File) {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview(null);
  }

  async function handleSave() {
    setSaving(true);

    let logoUrl = logoPreview === null ? null : settings?.logo_url ?? null;
    if (logoFile) {
      try {
        logoUrl = await uploadImage(supabase, "salon", logoFile, "logo");
      } catch (uploadErr) {
        showToast(uploadErr instanceof Error ? uploadErr.message : "Falha ao enviar a logo.", "error");
        setSaving(false);
        return;
      }
    }

    const payload = {
      name: name.trim() || "AUPALE",
      subtitle: subtitle.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      opening_time: `${openingTime}:00`,
      closing_time: `${closingTime}:00`,
      logo_url: logoUrl,
      pix_key: pixKey.trim() || null,
      pix_key_type: pixKey.trim() ? pixKeyType : null,
      pix_beneficiary: pixBeneficiary.trim() || null,
      city: city.trim() || "SAO PAULO",
      mercado_pago_enabled: mpEnabled,
      mercado_pago_token: mpToken.trim() || null,
      mercado_pago_link: mpLink.trim() || null,
    };

    const { error } = settings
      ? await supabase.from("salon_settings").update(payload).eq("id", settings.id)
      : await supabase.from("salon_settings").insert(payload).select().single();

    setSaving(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setLogoFile(null);
    showToast("Configurações salvas");
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 6) {
      setPasswordError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    showToast("Senha alterada com sucesso");
  }

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <PageHeader title="Configurações" subtitle="Preferências do salão e da conta" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Configurações" subtitle="Preferências do salão e da conta" />

      <div className="flex flex-col gap-6">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Store size={18} className="text-gold" strokeWidth={1.75} />
            <h2 className="font-display text-lg text-text">Dados do salão</h2>
          </div>
          <div className="flex flex-col gap-4">
            <ImageUpload
              label="Logo do salão"
              alt="Logo"
              previewUrl={logoPreview}
              onSelect={handleSelectLogo}
              onRemove={handleRemoveLogo}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Subtítulo" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input label="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Clock size={18} className="text-gold" strokeWidth={1.75} />
            <h2 className="font-display text-lg text-text">Horário de funcionamento</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Abertura"
              type="time"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
            />
            <Input
              label="Fechamento"
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
            />
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <QrCode size={18} className="text-gold" strokeWidth={1.75} />
            <h2 className="font-display text-lg text-text">Pix</h2>
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
              <Select
                label="Tipo da chave"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
              >
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label="Nome do beneficiário"
              value={pixBeneficiary}
              onChange={(e) => setPixBeneficiary(e.target.value)}
              placeholder="Nome que aparece no Pix"
            />
            <Input
              label="Cidade (para PIX)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="SAO PAULO"
            />
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-gold" strokeWidth={1.75} />
            <h2 className="font-display text-lg text-text">Mercado Pago</h2>
          </div>
          <div className="flex flex-col gap-4">
            <Toggle
              checked={mpEnabled}
              onChange={setMpEnabled}
              label="Habilitado"
              description="Mostra o link de pagamento por cartão para o cliente no carrinho"
            />
            <Input
              label="Link de pagamento"
              value={mpLink}
              onChange={(e) => setMpLink(e.target.value)}
              type="url"
              placeholder="https://mpago.la/..."
            />
            <Input
              label="Token de acesso"
              value={mpToken}
              onChange={(e) => setMpToken(e.target.value)}
              type="password"
              placeholder="Para uso futuro"
            />
          </div>
        </Card>

        <Button onClick={handleSave} loading={saving} className="w-full sm:w-auto sm:self-end">
          <Save size={16} />
          Salvar Configurações
        </Button>

        <WhatsappSettings />

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <UserCircle size={18} className="text-gold" strokeWidth={1.75} />
            <h2 className="font-display text-lg text-text">Conta</h2>
          </div>
          <div className="flex flex-col gap-4">
            <Input label="E-mail" value={user?.email ?? ""} disabled />

            <div className="flex items-center justify-between gap-3 rounded-btn border border-border p-3">
              <div>
                <p className="text-sm text-text">Aparência</p>
                <p className="text-xs text-textDim">Alterna entre o tema claro e o escuro</p>
              </div>
              <ThemeToggle className="border border-border" />
            </div>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PasswordInput
                  label="Nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <PasswordInput
                  label="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError && <p className="text-sm text-danger">{passwordError}</p>}
              <Button
                type="submit"
                variant="secondary"
                loading={changingPassword}
                disabled={!newPassword && !confirmPassword}
                className="w-full sm:w-auto sm:self-end"
              >
                <KeyRound size={16} />
                Alterar senha
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}

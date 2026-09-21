"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Save,
  PlugZap,
  Play,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  Cake,
  CalendarClock,
  CalendarCheck,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import Badge from "@/components/ui/Badge";
import PasswordInput from "@/components/ui/PasswordInput";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatPhone } from "@/lib/utils";
import { PROVIDER_OPTIONS } from "@/lib/whatsapp/providers";
import { renderTemplate, SAMPLE_VARS, TEMPLATE_VARIABLES } from "@/lib/whatsapp/render";
import type {
  WhatsappConfigPublic,
  WhatsappMessageStatus,
  WhatsappMessageType,
  WhatsappProvider,
  WhatsappQueueMessage,
  WhatsappTemplate,
} from "@/lib/types/database";

const TYPE_META: Record<WhatsappMessageType, { label: string; icon: typeof Cake; when: string }> = {
  lembrete: { label: "Lembrete", icon: CalendarClock, when: "Enviado na manhã do dia anterior ao horário" },
  aniversario: { label: "Aniversário", icon: Cake, when: "Enviado no dia do aniversário do cliente" },
  confirmacao: { label: "Confirmação", icon: CalendarCheck, when: "Enviado assim que o agendamento é criado" },
};

const STATUS_TONE: Record<WhatsappMessageStatus, "success" | "danger" | "gold" | "info"> = {
  enviado: "success",
  erro: "danger",
  pendente: "gold",
  enviando: "info",
};

const STATUS_LABEL: Record<WhatsappMessageStatus, string> = {
  enviado: "Enviado",
  erro: "Erro",
  pendente: "Pendente",
  enviando: "Enviando",
};

const LOG_SIZE = 20;

export default function WhatsappSettings() {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<WhatsappProvider>("z-api");
  const [urlApi, setUrlApi] = useState("");
  const [instancia, setInstancia] = useState("");
  const [token, setToken] = useState("");
  const [tokenStored, setTokenStored] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const [log, setLog] = useState<WhatsappQueueMessage[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<string | null>(null);

  const providerMeta = PROVIDER_OPTIONS.find((p) => p.value === provider) ?? PROVIDER_OPTIONS[0];

  const loadLog = useCallback(async () => {
    setLoadingLog(true);
    const { data } = await supabase
      .from("whatsapp_mensagens_fila")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LOG_SIZE);
    setLog((data as WhatsappQueueMessage[]) ?? []);
    setLoadingLog(false);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [configRes, templatesRes] = await Promise.all([
        fetch("/api/whatsapp/config").then((r) => (r.ok ? (r.json() as Promise<WhatsappConfigPublic>) : null)),
        supabase.from("whatsapp_templates").select("*").order("created_at", { ascending: true }),
      ]);
      if (!mounted) return;
      if (configRes) {
        setProvider(configRes.provider);
        setUrlApi(configRes.url_api);
        setInstancia(configRes.instancia);
        setAtivo(configRes.ativo);
        setTokenStored(configRes.token_configurado);
      }
      const list = (templatesRes.data as WhatsappTemplate[]) ?? [];
      setTemplates(list);
      setDrafts(Object.fromEntries(list.map((t) => [t.id, t.mensagem_template])));
      setLoading(false);
    }
    load();
    loadLog();
    return () => {
      mounted = false;
    };
  }, [supabase, loadLog]);

  function handleProviderChange(next: WhatsappProvider) {
    setProvider(next);
    setTestResult(null);
    // Suggest the provider's usual base URL only while the field is empty or still a known default.
    const knownDefaults = PROVIDER_OPTIONS.map((p) => p.defaultUrl);
    if (!urlApi || knownDefaults.includes(urlApi)) {
      setUrlApi(PROVIDER_OPTIONS.find((p) => p.value === next)?.defaultUrl ?? "");
    }
  }

  async function handleSaveConfig() {
    setSaving(true);
    const res = await fetch("/api/whatsapp/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, url_api: urlApi, instancia, token_api: token, ativo }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      showToast(body.error ?? "Não foi possível salvar.", "error");
      return;
    }
    setToken("");
    setTokenStored(body.token_configurado);
    setAtivo(body.ativo);
    showToast("Configuração do WhatsApp salva");
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/whatsapp/testar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, url_api: urlApi, instancia, token_api: token }),
    });
    const body = await res.json();
    setTesting(false);
    setTestResult(
      body.ok
        ? { ok: true, text: body.detail ?? "Conexão realizada com sucesso." }
        : { ok: false, text: body.error ?? "Não foi possível conectar." }
    );
  }

  async function handleToggleTemplate(template: WhatsappTemplate, checked: boolean) {
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, ativo: checked } : t)));
    const { error } = await supabase.from("whatsapp_templates").update({ ativo: checked }).eq("id", template.id);
    if (error) {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, ativo: !checked } : t)));
      showToast(error.message, "error");
    }
  }

  async function handleSaveTemplate(template: WhatsappTemplate) {
    const text = (drafts[template.id] ?? "").trim();
    if (!text) {
      showToast("A mensagem não pode ficar vazia.", "error");
      return;
    }
    setSavingTemplate(template.id);
    const { error } = await supabase
      .from("whatsapp_templates")
      .update({ mensagem_template: text })
      .eq("id", template.id);
    setSavingTemplate(null);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, mensagem_template: text } : t)));
    showToast("Mensagem salva");
  }

  function insertVariable(templateId: string, key: string) {
    const el = textareas.current[templateId];
    const placeholder = `{{${key}}}`;
    const current = drafts[templateId] ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + placeholder + current.slice(end);
    setDrafts((prev) => ({ ...prev, [templateId]: next }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  async function handleRunNow() {
    setRunning(true);
    setRunSummary(null);
    const res = await fetch("/api/cron/whatsapp");
    const body = await res.json();
    setRunning(false);
    if (!res.ok) {
      showToast(body.error ?? "Não foi possível executar a rotina.", "error");
      return;
    }
    const fila = body.fila as { ativo?: boolean; enviadas?: number; erros?: number } | undefined;
    setRunSummary(
      fila?.ativo === false
        ? "WhatsApp está desativado ou incompleto — nada foi enviado."
        : `Aniversariantes na fila: ${body.aniversariantes?.criados ?? 0} · Lembretes na fila: ${
            body.lembretes?.criados ?? 0
          } · Enviadas: ${fila?.enviadas ?? 0} · Com erro: ${fila?.erros ?? 0}`
    );
    loadLog();
  }

  async function handleResend(id: string) {
    setResendingId(id);
    const res = await fetch("/api/whatsapp/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await res.json();
    setResendingId(null);
    showToast(body.ok ? "Mensagem enviada" : (body.error ?? "Falha no envio."), body.ok ? "success" : "error");
    loadLog();
  }

  if (loading) {
    return (
      <Card>
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-gold" strokeWidth={1.75} />
          <h2 className="font-display text-lg text-text">WhatsApp</h2>
        </div>
        <Badge tone={ativo ? "success" : "neutral"}>{ativo ? "Ativo" : "Desativado"}</Badge>
      </div>

      <p className="mb-5 text-sm text-textDim">
        Mensagens automáticas de confirmação, lembrete e aniversário. Conecte um provedor de WhatsApp
        para começar — enquanto estiver desativado, nada é enviado.
      </p>

      {/* ---- Conexão ---- */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Provedor"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as WhatsappProvider)}
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Input
            label={providerMeta.instanceLabel}
            value={instancia}
            onChange={(e) => setInstancia(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Input
          label="URL da API"
          value={urlApi}
          onChange={(e) => setUrlApi(e.target.value)}
          placeholder={providerMeta.defaultUrl}
          autoComplete="off"
        />
        <PasswordInput
          label="Token / API Key"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={tokenStored ? "Token já configurado — deixe em branco para manter" : "Cole o token aqui"}
          autoComplete="new-password"
        />
        <p className="-mt-2 text-xs text-textDim">{providerMeta.hint}</p>

        <div className="rounded-btn border border-border p-3">
          <Toggle
            checked={ativo}
            onChange={setAtivo}
            label="Ativar envio automático"
            description="Liga ou desliga o WhatsApp como um todo. Cada tipo de mensagem tem seu próprio botão abaixo."
          />
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-btn border p-3 text-sm ${
              testResult.ok
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {testResult.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
            <span>{testResult.text}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={handleTest} loading={testing}>
            <PlugZap size={16} />
            Testar conexão
          </Button>
          <Button onClick={handleSaveConfig} loading={saving}>
            <Save size={16} />
            Salvar WhatsApp
          </Button>
        </div>
      </div>

      {/* ---- Mensagens ---- */}
      <div className="mt-8 border-t border-border pt-6">
        <h3 className="mb-1 font-display text-base text-text">Mensagens</h3>
        <p className="mb-4 text-xs text-textDim">
          Ative ou desative cada tipo e edite o texto. Variáveis disponíveis:{" "}
          {TEMPLATE_VARIABLES.map((v) => `{{${v.key}}}`).join("  ")}
        </p>

        <div className="flex flex-col gap-5">
          {templates.map((t) => {
            const meta = TYPE_META[t.tipo];
            const Icon = meta.icon;
            const draft = drafts[t.id] ?? "";
            const dirty = draft.trim() !== t.mensagem_template;
            return (
              <div key={t.id} className="rounded-btn border border-border p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Icon size={17} className="mt-0.5 shrink-0 text-gold" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-medium text-text">{t.nome}</p>
                      <p className="text-xs text-textDim">{meta.when}</p>
                    </div>
                  </div>
                  <Toggle checked={t.ativo} onChange={(c) => handleToggleTemplate(t, c)} />
                </div>

                <textarea
                  ref={(el) => {
                    textareas.current[t.id] = el;
                  }}
                  value={draft}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  rows={4}
                  className="w-full resize-y rounded-btn border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
                />

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(t.id, v.key)}
                      title={v.label}
                      className="rounded-badge border border-border px-2.5 py-1 text-[11px] text-textDim transition duration-200 hover:border-gold hover:text-gold"
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-btn bg-surface2 p-3">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-textDim">Prévia</p>
                  <p className="whitespace-pre-wrap text-sm text-text">{renderTemplate(draft, SAMPLE_VARS)}</p>
                </div>

                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!dirty}
                    loading={savingTemplate === t.id}
                    onClick={() => handleSaveTemplate(t)}
                  >
                    <Save size={14} />
                    Salvar mensagem
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Rotina + log ---- */}
      <div className="mt-8 border-t border-border pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base text-text">Histórico de envios</h3>
            <p className="text-xs text-textDim">
              Registro de auditoria das últimas {LOG_SIZE} mensagens. A rotina diária roda sozinha às 08h.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={loadLog} loading={loadingLog}>
              <RefreshCw size={14} />
              Atualizar
            </Button>
            <Button size="sm" onClick={handleRunNow} loading={running}>
              <Play size={14} />
              Executar rotina agora
            </Button>
          </div>
        </div>

        {runSummary && (
          <p className="mb-3 rounded-btn bg-surface2 p-3 text-xs text-textDim">{runSummary}</p>
        )}

        {log.length === 0 ? (
          <p className="rounded-btn border border-dashed border-border p-6 text-center text-sm text-textDim">
            Nenhuma mensagem registrada ainda.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {log.map((m) => (
              <div key={m.id} className="rounded-btn border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                    <span className="text-xs text-textDim">{TYPE_META[m.tipo].label}</span>
                    <span className="text-xs text-text">{formatPhone(m.telefone.replace(/^55/, ""))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-textDim">
                      {formatDateTime(m.enviado_em ?? m.agendado_para)}
                    </span>
                    {(m.status === "erro" || m.status === "pendente") && (
                      <button
                        type="button"
                        onClick={() => handleResend(m.id)}
                        disabled={resendingId === m.id}
                        className="inline-flex items-center gap-1 rounded-btn border border-border px-2 py-1 text-[11px] text-textDim transition duration-200 hover:border-gold hover:text-gold disabled:opacity-50"
                      >
                        <Send size={11} />
                        {resendingId === m.id ? "Enviando..." : "Reenviar"}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-textDim">{m.mensagem}</p>
                {m.erro_msg && <p className="mt-1 text-xs text-danger">{m.erro_msg}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

import type { WhatsappProvider } from "@/lib/types/database";

export interface ProviderConfig {
  provider: WhatsappProvider;
  url_api: string | null;
  token_api: string | null;
  instancia: string | null;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export const PROVIDER_OPTIONS: {
  value: WhatsappProvider;
  label: string;
  defaultUrl: string;
  instanceLabel: string;
  hint: string;
}[] = [
  {
    value: "z-api",
    label: "Z-API",
    defaultUrl: "https://api.z-api.io",
    instanceLabel: "ID da instância",
    hint: "Token = token da instância no painel da Z-API.",
  },
  {
    value: "evolution",
    label: "Evolution API",
    defaultUrl: "https://sua-evolution.exemplo.com",
    instanceLabel: "Nome da instância",
    hint: "Token = apikey da instância (ou a chave global).",
  },
  {
    value: "meta",
    label: "WhatsApp Cloud API (Meta)",
    defaultUrl: "https://graph.facebook.com/v20.0",
    instanceLabel: "Phone Number ID",
    hint: "Fora da janela de 24h a Meta exige templates aprovados; texto livre só chega a quem falou com você recentemente.",
  },
];

const TIMEOUT_MS = 12_000;

function isMissing(cfg: ProviderConfig): string | null {
  if (!cfg.url_api?.trim()) return "URL da API não configurada.";
  if (!cfg.token_api?.trim()) return "Token da API não configurado.";
  if (!cfg.instancia?.trim()) return "Instância não configurada.";
  if (!/^https?:\/\//i.test(cfg.url_api.trim())) return "A URL da API deve começar com http:// ou https://.";
  return null;
}

async function request(url: string, init: RequestInit): Promise<{ status: number; body: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

function describeError(status: number, body: unknown, text: string): string {
  const b = body as Record<string, unknown> | null;
  const nested = (b?.error as Record<string, unknown> | undefined)?.message;
  const msg =
    (typeof nested === "string" && nested) ||
    (typeof b?.message === "string" && b.message) ||
    (typeof b?.error === "string" && b.error) ||
    text.slice(0, 200);
  return `HTTP ${status}${msg ? ` — ${msg}` : ""}`;
}

function baseUrl(cfg: ProviderConfig): string {
  return cfg.url_api!.trim().replace(/\/+$/, "");
}

/** Sends a plain text message. `phone` must already be digits with country code. */
export async function sendText(cfg: ProviderConfig, phone: string, message: string): Promise<SendResult> {
  const missing = isMissing(cfg);
  if (missing) return { ok: false, error: missing };

  const base = baseUrl(cfg);
  const instance = encodeURIComponent(cfg.instancia!.trim());
  const token = cfg.token_api!.trim();

  try {
    let res;
    if (cfg.provider === "z-api") {
      res = await request(`${base}/instances/${instance}/token/${encodeURIComponent(token)}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });
    } else if (cfg.provider === "evolution") {
      res = await request(`${base}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: token },
        body: JSON.stringify({ number: phone, text: message }),
      });
    } else {
      res = await request(`${base}/${instance}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      });
    }
    if (res.status >= 200 && res.status < 300) return { ok: true };
    return { ok: false, error: describeError(res.status, res.body, res.text) };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, error: aborted ? "Tempo esgotado ao contatar o provedor." : `Falha de rede: ${(e as Error).message}` };
  }
}

/** Checks that credentials are valid and (where the provider exposes it) that the number is connected. */
export async function testConnection(cfg: ProviderConfig): Promise<SendResult & { detail?: string }> {
  const missing = isMissing(cfg);
  if (missing) return { ok: false, error: missing };

  const base = baseUrl(cfg);
  const instance = encodeURIComponent(cfg.instancia!.trim());
  const token = cfg.token_api!.trim();

  try {
    if (cfg.provider === "z-api") {
      const res = await request(`${base}/instances/${instance}/token/${encodeURIComponent(token)}/status`, {
        method: "GET",
      });
      if (res.status < 200 || res.status >= 300) return { ok: false, error: describeError(res.status, res.body, res.text) };
      const b = res.body as { connected?: boolean; error?: string } | null;
      if (b?.connected === true) return { ok: true, detail: "Instância conectada ao WhatsApp." };
      return { ok: false, error: b?.error || "Credenciais válidas, mas a instância não está conectada (leia o QR code no painel)." };
    }
    if (cfg.provider === "evolution") {
      const res = await request(`${base}/instance/connectionState/${instance}`, {
        method: "GET",
        headers: { apikey: token },
      });
      if (res.status < 200 || res.status >= 300) return { ok: false, error: describeError(res.status, res.body, res.text) };
      const state = (res.body as { instance?: { state?: string } } | null)?.instance?.state;
      if (state === "open") return { ok: true, detail: "Instância conectada ao WhatsApp." };
      return { ok: false, error: `Credenciais válidas, mas a instância está "${state ?? "desconhecida"}".` };
    }
    const res = await request(`${base}/${instance}?fields=display_phone_number,verified_name`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status < 200 || res.status >= 300) return { ok: false, error: describeError(res.status, res.body, res.text) };
    const b = res.body as { display_phone_number?: string; verified_name?: string } | null;
    return { ok: true, detail: `Número ${b?.display_phone_number ?? ""} ${b?.verified_name ? `(${b.verified_name})` : ""}`.trim() };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, error: aborted ? "Tempo esgotado ao contatar o provedor." : `Falha de rede: ${(e as Error).message}` };
  }
}

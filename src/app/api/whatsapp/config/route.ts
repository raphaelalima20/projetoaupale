import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCaller } from "@/lib/api-auth";
import { loadConfig } from "@/lib/whatsapp/queue";
import type { WhatsappConfig, WhatsappConfigPublic, WhatsappProvider } from "@/lib/types/database";

export const dynamic = "force-dynamic";

const PROVIDERS: WhatsappProvider[] = ["z-api", "evolution", "meta"];

function toPublic(config: WhatsappConfig | null): WhatsappConfigPublic {
  return {
    provider: config?.provider ?? "z-api",
    url_api: config?.url_api ?? "",
    instancia: config?.instancia ?? "",
    ativo: config?.ativo ?? false,
    token_configurado: !!config?.token_api,
  };
}

/** The provider token never leaves the server: the browser only learns whether one is stored. */
export async function GET(request: Request) {
  const caller = await resolveCaller(request);
  if (caller.kind !== "admin") return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json(toPublic(await loadConfig(createAdminClient())));
}

export async function PUT(request: Request) {
  const caller = await resolveCaller(request);
  if (caller.kind !== "admin") return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  const current = await loadConfig(admin);

  const provider = body.provider as WhatsappProvider;
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Provedor inválido." }, { status: 400 });
  }

  const urlApi = String(body.url_api ?? "").trim().replace(/\/+$/, "");
  if (urlApi && !/^https?:\/\/\S+$/i.test(urlApi)) {
    return NextResponse.json({ error: "A URL da API deve começar com http:// ou https://." }, { status: 400 });
  }
  const instancia = String(body.instancia ?? "").trim();
  // Blank token = keep the stored one (the field is never pre-filled in the browser).
  const newToken = typeof body.token_api === "string" ? body.token_api.trim() : "";
  const token = newToken || current?.token_api || "";
  const ativo = !!body.ativo;

  if (ativo && (!urlApi || !instancia || !token)) {
    return NextResponse.json(
      { error: "Preencha URL da API, token e instância antes de ativar o WhatsApp." },
      { status: 400 }
    );
  }

  const payload = {
    provider,
    url_api: urlApi || null,
    instancia: instancia || null,
    token_api: token || null,
    ativo,
  };

  const { error } = current
    ? await admin.from("whatsapp_config").update(payload).eq("id", current.id)
    : await admin.from("whatsapp_config").insert(payload);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(toPublic(await loadConfig(admin)));
}

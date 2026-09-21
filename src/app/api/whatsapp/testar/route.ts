import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCaller } from "@/lib/api-auth";
import { loadConfig } from "@/lib/whatsapp/queue";
import { testConnection } from "@/lib/whatsapp/providers";
import type { WhatsappProvider } from "@/lib/types/database";

export const dynamic = "force-dynamic";

const PROVIDERS: WhatsappProvider[] = ["z-api", "evolution", "meta"];

/**
 * "Testar conexão": validates the values currently typed in the form (falling back to the stored
 * token when the token field was left blank) without saving anything.
 */
export async function POST(request: Request) {
  const caller = await resolveCaller(request);
  if (caller.kind !== "admin") return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const stored = await loadConfig(createAdminClient());

  const provider = PROVIDERS.includes(body.provider) ? (body.provider as WhatsappProvider) : stored?.provider ?? "z-api";
  const typedToken = typeof body.token_api === "string" ? body.token_api.trim() : "";

  const result = await testConnection({
    provider,
    url_api: String(body.url_api ?? stored?.url_api ?? "").trim().replace(/\/+$/, ""),
    instancia: String(body.instancia ?? stored?.instancia ?? "").trim(),
    token_api: typedToken || stored?.token_api || "",
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

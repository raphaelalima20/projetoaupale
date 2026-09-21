import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canRunAutomation, resolveCaller } from "@/lib/api-auth";
import { resendMessage, sendNow } from "@/lib/whatsapp/queue";
import type { WhatsappMessageType } from "@/lib/types/database";

export const dynamic = "force-dynamic";

const TYPES: WhatsappMessageType[] = ["lembrete", "aniversario", "confirmacao"];

/**
 * Sends a message through the configured provider.
 *  - `{ id }`: sends (or re-sends) an existing queue message right now.
 *  - `{ telefone, mensagem, tipo }`: logs a new message in the queue and sends it right now.
 * Restricted to the admin or the cron secret — never callable by visitors.
 */
export async function POST(request: Request) {
  const caller = await resolveCaller(request);
  if (!canRunAutomation(caller)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  if (typeof body.id === "string") {
    const result = await resendMessage(admin, body.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  if (typeof body.telefone === "string" && typeof body.mensagem === "string" && body.mensagem.trim()) {
    const tipo: WhatsappMessageType = TYPES.includes(body.tipo) ? body.tipo : "confirmacao";
    const digits = body.telefone.replace(/\D/g, "");
    if (digits.length < 10) {
      return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
    }
    const result = await sendNow(admin, { telefone: digits, mensagem: body.mensagem.trim(), tipo });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  return NextResponse.json({ error: "Informe `id` da fila ou `telefone` + `mensagem`." }, { status: 400 });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canRunAutomation, resolveCaller } from "@/lib/api-auth";
import { processQueue, queueBirthdays, queueTomorrowReminders } from "@/lib/whatsapp/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily job (see vercel.json): queue today's birthdays and tomorrow's reminders, then send
 * everything that is due. Admins can also trigger it by hand from Configurações → WhatsApp.
 */
export async function GET(request: Request) {
  const caller = await resolveCaller(request);
  if (!canRunAutomation(caller)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const result: Record<string, unknown> = {};
  // Each step is isolated so one failure doesn't stop the others.
  for (const [name, step] of [
    ["aniversariantes", () => queueBirthdays(admin)],
    ["lembretes", () => queueTomorrowReminders(admin)],
    ["fila", () => processQueue(admin, 50)],
  ] as const) {
    try {
      result[name] = await step();
    } catch (e) {
      result[name] = { error: (e as Error).message };
    }
  }
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canRunAutomation, resolveCaller } from "@/lib/api-auth";
import { queueBirthdays } from "@/lib/whatsapp/queue";

export const dynamic = "force-dynamic";

/** Finds clients whose birthday is today and queues a greeting (once per client per year). */
async function handle(request: Request) {
  const caller = await resolveCaller(request);
  if (!canRunAutomation(caller)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const result = await queueBirthdays(createAdminClient());
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

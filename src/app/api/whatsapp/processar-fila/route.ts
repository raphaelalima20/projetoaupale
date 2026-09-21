import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canRunAutomation, resolveCaller } from "@/lib/api-auth";
import { processQueue } from "@/lib/whatsapp/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Processes due pending messages. GET so Vercel Cron can call it; POST for manual runs. */
async function handle(request: Request) {
  const caller = await resolveCaller(request);
  if (!canRunAutomation(caller)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const summary = await processQueue(createAdminClient());
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

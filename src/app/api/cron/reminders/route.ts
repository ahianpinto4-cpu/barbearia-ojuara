import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/server/env";
import { processDueNotifications } from "@/lib/server/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Disparado pelo Vercel Cron (Authorization: Bearer CRON_SECRET) ou outro agendador. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret ?? ""}`;
  if (!env.cronSecret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const summary = await processDueNotifications();
  return Response.json({ ok: true, ...summary });
}

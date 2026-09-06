// Quota-free health check. Confirms which deploy and model are live, and
// whether the key is present — without calling Gemini.

import { REASONING_MODEL, EMBEDDING_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    reasoning_model: REASONING_MODEL,
    embedding_model: EMBEDDING_MODEL,
    key_present: Boolean(process.env.GEMINI_API_KEY),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    time: new Date().toISOString(),
  });
}

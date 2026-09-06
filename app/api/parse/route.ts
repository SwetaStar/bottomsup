// Stage 1 — Parse. POST { rfpText } -> structured RFP object.

import { callGemini } from "@/lib/gemini";
import { safeParseJSON } from "@/lib/json";
import { parsePrompt } from "@/lib/prompts";
import type { ParsedRFP } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rfpText = body?.rfpText;
    if (typeof rfpText !== "string" || rfpText.trim().length < 20) {
      return Response.json(
        { error: "rfpText (string, the full RFP) is required" },
        { status: 400 }
      );
    }

    const raw = await callGemini({
      prompt: parsePrompt(rfpText),
      maxOutputTokens: 2000,
    });
    const parsed = safeParseJSON<ParsedRFP>(raw);

    return Response.json({ parsed });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

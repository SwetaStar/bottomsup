// Stage 2 + DP1 — Qualify. POST { rfp } -> weighted scorecard + recommendation.
//
// This route produces the recommendation and the numeric score. It does NOT
// decide: partner_decision_required is always true, and the pipeline halts at
// HA1 (in the UI) until a human approves. No retrieval or drafting happens here.

import { callGemini } from "@/lib/gemini";
import { safeParseJSON } from "@/lib/json";
import { scorePrompt } from "@/lib/prompts";
import { criteria } from "@/lib/data";
import type { ParsedRFP, ScoreResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rfp = body?.rfp as ParsedRFP | undefined;
    if (!rfp || typeof rfp !== "object") {
      return Response.json(
        { error: "rfp (the parsed RFP object from /api/parse) is required" },
        { status: 400 }
      );
    }

    const raw = await callGemini({
      prompt: scorePrompt(
        JSON.stringify(rfp, null, 2),
        JSON.stringify(criteria, null, 2)
      ),
    });
    const result = safeParseJSON<ScoreResult>(raw);

    // Enforce the one invariant the demo depends on: the model never decides.
    result.partner_decision_required = true;

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

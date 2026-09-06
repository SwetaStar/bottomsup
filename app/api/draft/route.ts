// Stage 4 — Draft. POST { rfp, selected } -> proposal outline, a source on
// every claim. Larger token budget than the other routes (SPEC), bumped for
// gemini-3.6-flash reasoning overhead. Runs only after HA1 approval.

import { callGemini } from "@/lib/gemini";
import { safeParseJSON } from "@/lib/json";
import { draftPrompt } from "@/lib/prompts";
import { criteria } from "@/lib/data";
import type { Draft, ParsedRFP, SelectedRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rfp = body?.rfp as ParsedRFP | undefined;
    const selected = body?.selected as SelectedRecord[] | undefined;

    if (!rfp || typeof rfp !== "object") {
      return Response.json(
        { error: "rfp (the parsed RFP object) is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(selected) || selected.length === 0) {
      return Response.json(
        { error: "selected (the chosen comparables from /api/retrieve) is required" },
        { status: 400 }
      );
    }

    const raw = await callGemini({
      prompt: draftPrompt(
        JSON.stringify(rfp, null, 2),
        JSON.stringify(selected, null, 2),
        JSON.stringify(criteria.firm_context, null, 2)
      ),
      maxOutputTokens: 8000,
    });
    const draft = safeParseJSON<Draft>(raw);

    if (draft.commercial_recommendation) {
      draft.commercial_recommendation.requires_partner_approval = true;
    }

    return Response.json(draft);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

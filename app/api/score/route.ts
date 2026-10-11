// Stage 2 + DP1 — Qualify. POST { rfp, clientId? } -> weighted scorecard +
// recommendation.
//
// This route produces the recommendation and the numeric score. It does NOT
// decide: partner_decision_required is always true, and the pipeline halts at
// HA1 (in the UI) until a human approves. No retrieval or drafting happens here.
//
// E3 ("client MSA does not permit generative AI tooling") is decided here in
// code, not by the model — the model is given only the RFP text, which has
// no reliable way to distinguish a disclosure request (e.g. "confirm in
// writing whether AI tooling will be used") from an existing contractual
// prohibition. Deciding E3 from the real engagement record, at Qualify time,
// means a partner sees a genuine MSA block before Approval — not only after
// Retrieve and Draft have already run and spent model calls on an engagement
// that can never be completed this way.

import { callGemini } from "@/lib/gemini";
import { safeParseJSON } from "@/lib/json";
import { scorePrompt } from "@/lib/prompts";
import { criteria, recordsForClient } from "@/lib/data";
import type { ParsedRFP, ScoreResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rfp = body?.rfp as ParsedRFP | undefined;
    const clientId =
      typeof body?.clientId === "string" ? body.clientId.trim() : "";
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

    // The model was told not to evaluate E3 — drop any entry it produced
    // anyway (defense in depth) before the server's own determination below.
    result.escalations_triggered = (result.escalations_triggered ?? []).filter(
      (e) => e.id !== "E3"
    );

    // Deterministic E3: does this client have an on-file engagement whose
    // MSA forbids generative AI tooling? A brand-new client with no record
    // (e.g. a new prospect) cannot trigger this — there is nothing on file
    // to violate.
    const restricted = clientId
      ? recordsForClient(clientId).find((r) => r.ai_use_permitted === false)
      : undefined;
    if (restricted) {
      const e3Rule =
        criteria.escalations.find((e) => e.id === "E3")?.rule ??
        "Client MSA does not permit generative AI tooling in delivery";
      result.escalations_triggered.push({
        id: "E3",
        rule: e3Rule,
        detail: `${restricted.id} (${restricted.company.name}) MSA on file: "${restricted.msa_note}" — confirmed contractual restriction, not a disclosure request.`,
      });
      // An escalation overrides the score outright. The model couldn't have
      // known this one, so the server corrects the recommendation it
      // returned rather than leaving a DECLINE-worthy fact under a PURSUE
      // badge.
      result.recommendation = "DECLINE";
    }

    // Enforce the one invariant the demo depends on: the model never decides.
    result.partner_decision_required = true;

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

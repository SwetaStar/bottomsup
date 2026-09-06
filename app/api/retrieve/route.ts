// Stage 3 — Retrieve (vector similarity). POST { rfp, topK? } ->
//   { query, selected[], all_scored[] }
//
// all_scored lists ALL 12 records with their cosine similarity, not just the
// top 3. That full ranked list is the visual proof that retrieval is real
// vector similarity and not the model guessing — a judge asking "how do you
// know it retrieved rather than invented?" is answered by pointing at the
// numbers.
//
// This route runs only after the HA1 approval click (enforced by the UI).

import { callGemini } from "@/lib/gemini";
import { safeParseJSON } from "@/lib/json";
import { retrieveReasonPrompt } from "@/lib/prompts";
import {
  cosineSimilarity,
  embedQuery,
  getCorpusEmbeddings,
} from "@/lib/embeddings";
import { records, recordById } from "@/lib/data";
import type {
  ParsedRFP,
  RetrieveReason,
  RetrieveResult,
  ScoredRecord,
  SelectedRecord,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function buildQuery(rfp: ParsedRFP): string {
  // SPEC: sector + scope items joined + preferred commercial structure.
  return [
    rfp.sector ?? "",
    (rfp.scope_items ?? []).join(" "),
    rfp.preferred_commercial_structure ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rfp = body?.rfp as ParsedRFP | undefined;
    const topK = Number.isInteger(body?.topK) ? Math.max(1, body.topK) : 3;

    if (!rfp || typeof rfp !== "object") {
      return Response.json(
        { error: "rfp (the parsed RFP object from /api/parse) is required" },
        { status: 400 }
      );
    }

    const query = buildQuery(rfp);
    if (!query) {
      return Response.json(
        { error: "parsed RFP has no sector/scope/structure to build a query from" },
        { status: 400 }
      );
    }

    // 1-3. Embed the query, load the 12 corpus vectors, score every record.
    const [queryVec, corpusVecs] = await Promise.all([
      embedQuery(query),
      getCorpusEmbeddings(),
    ]);
    const byId = new Map(corpusVecs.map((c) => [c.id, c.vector]));

    const all_scored: ScoredRecord[] = records
      .map((r) => {
        const vec = byId.get(r.id);
        return {
          id: r.id,
          company: r.company.name,
          sector: r.company.sector,
          title: r.engagement.title,
          outcome: r.outcome.status,
          similarity: vec ? cosineSimilarity(queryVec, vec) : 0,
          ai_use_permitted: r.ai_use_permitted,
          excluded_restricted: false,
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    // 4. Top K become `selected` — but a record whose MSA does not permit AI
    // tooling (ai_use_permitted === false) is never drafted from. It stays in
    // the ranked list, marked, so the retrieval is still visibly honest; it is
    // just skipped when picking what to build the proposal on. DP3's CHECK 2
    // remains as a backstop for anything that slips through (e.g. Phase 6
    // uploads).
    for (const s of all_scored) {
      if (!s.ai_use_permitted) s.excluded_restricted = true;
    }
    const top = all_scored.filter((s) => s.ai_use_permitted).slice(0, topK);

    // 5. One grounded Gemini call per selected record. Sequential to stay well
    // under the free-tier rate limit; a failure yields reason: null rather than
    // failing the whole route.
    const selected: SelectedRecord[] = [];
    for (const s of top) {
      const record = recordById(s.id)!;
      let reason: RetrieveReason | null = null;
      try {
        const raw = await callGemini({
          prompt: retrieveReasonPrompt(
            JSON.stringify(rfp, null, 2),
            JSON.stringify(record, null, 2)
          ),
          maxOutputTokens: 2000,
        });
        reason = safeParseJSON<RetrieveReason>(raw);
      } catch (err) {
        console.error(`retrieve: reason call failed for ${s.id}:`, err);
      }
      selected.push({ ...s, record, reason });
    }

    const result: RetrieveResult = { query, selected, all_scored };
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

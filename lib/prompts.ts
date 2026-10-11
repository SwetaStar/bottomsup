// All four prompts, verbatim from SPEC section 6, as exported template
// functions. Every one ends with an instruction to return raw JSON only.

export function parsePrompt(rfpText: string): string {
  return `You are a proposal analyst at Vertex Consulting Group. Read the RFP below
and extract its structure. Do not evaluate it. Extraction only.

Return RAW JSON ONLY. No preamble, no markdown fences. Begin with { and end with }.

{
  "client_name": "", "reference": "", "sector": "", "deadline": "",
  "engagement_start": "", "duration": "", "budget_range": "",
  "preferred_commercial_structure": "",
  "scope_items": [""],
  "mandatory_requirements": [{"ref": "", "requirement": ""}],
  "evaluation_criteria": [{"criterion": "", "weight": ""}],
  "ai_disclosure_required": true,
  "notable_risks": [""]
}

Rules:
1. Copy facts from the RFP. Do not add, infer or improve anything.
2. If a field is not stated, write null. Never guess.
3. ai_disclosure_required is true only if the RFP explicitly asks the bidder
   to disclose use of AI or automated tooling.
4. notable_risks: at most four, only risks the RFP itself creates.

RFP TEXT:
${rfpText}`;
}

export function scorePrompt(rfpJson: string, criteriaJson: string): string {
  return `You are VCG's pursuit qualification engine. Score this opportunity against
VCG's published criteria. You recommend. You do not decide.

=== CRITERIA AND FIRM CONTEXT ===
${criteriaJson}

=== OPPORTUNITY ===
${rfpJson}

Return RAW JSON ONLY:
{
  "scores": [{"id":"C1","criterion":"","weight":0,"score":0,"contribution":0,"reasoning":"","evidence":""}],
  "weighted_total": 0.00,
  "recommendation": "PURSUE | PURSUE WITH CONDITIONS | DECLINE",
  "conditions": [""],
  "escalations_triggered": [{"id":"","rule":"","detail":""}],
  "rationale": "",
  "partner_decision_required": true
}

Rules:
1. Score all six criteria. Use the supplied weights, not your own.
2. contribution = score x weight, 2 decimals. weighted_total = sum of contributions.
3. Apply the supplied thresholds. Do not invent thresholds.
4. evidence must quote or closely paraphrase the opportunity or the criteria.
   If you have no evidence, write "no evidence available" and score 3.
5. Check escalations E1, E2 and E4 against the opportunity text. An escalation
   overrides the score.
6. Do NOT evaluate or report E3 ("client MSA does not permit generative AI
   tooling"). You were not given this client's contract, so you cannot know
   it — the server checks E3 from the actual contract record and adds it
   itself. If the opportunity merely asks the bidder to disclose or confirm
   AI/automated-tooling usage (a forward-looking disclosure request, not a
   statement that an existing contract forbids it), that is not E3 and is not
   any escalation — note it in rationale if relevant, nothing more.
7. rationale: at most three sentences, for a partner with thirty seconds.
8. partner_decision_required is always true.`;
}

export function retrieveReasonPrompt(rfpJson: string, recordJson: string): string {
  return `Explain why this past engagement is relevant to the opportunity below.
Ground every statement in the engagement record. Invent nothing.

=== OPPORTUNITY === ${rfpJson}
=== ENGAGEMENT RECORD === ${recordJson}

Return RAW JSON ONLY:
{
  "why_selected": "",
  "transferable_assets": [""],
  "applicable_win_themes": [""],
  "caveats": ""
}

If the engagement was LOST, say so in why_selected and state what the loss teaches.
caveats: where this engagement differs from the opportunity in a way that matters.`;
}

export function draftPrompt(
  rfpJson: string,
  selectedJson: string,
  firmContextJson: string
): string {
  return `Draft a proposal outline for a VCG partner to review, in VCG's standard nine-section
RFP response structure. This is a first draft for internal review. It is not a
deliverable and will not be sent to a client.

=== OPPORTUNITY === ${rfpJson}
=== SELECTED COMPARABLES (use these for case studies and win evidence) === ${selectedJson}
=== FIRM CONTEXT AND RATES === ${firmContextJson}

Return RAW JSON ONLY:
{
  "lead_department": {"name":"","reasoning":"","source":""},
  "cover": {"client_name":"","firm_name":"Vertex Consulting Group","reference":"","date":"","pitch":"","logo_note":"","source":""},
  "executive_summary": {"current_state":"","risks_of_inaction":"","future_state":"","why_us":"","source":""},
  "understanding": {
    "root_cause_diagnostic":"",
    "in_scope":[{"item":"","source":""}],
    "out_of_scope":[{"item":"","source":""}]
  },
  "methodology": {
    "phases":[
      {"phase":"Discovery & Assessment","weeks":"","activities":"","output":"","department":"","source":""},
      {"phase":"Analysis & Diagnostic","weeks":"","activities":"","output":"","department":"","source":""},
      {"phase":"Strategy & Recommendation","weeks":"","activities":"","output":"","department":"","source":""},
      {"phase":"Implementation Support / Enablement","weeks":"","activities":"","output":"","department":"","source":""}
    ],
    "toolkits":[{"name":"","use":"","source":""}]
  },
  "timeline": {
    "milestones":[{"milestone":"","when":"","phase":"","source":""}],
    "deliverables":[{"name":"","description":"","source":""}]
  },
  "team": {
    "governance":[{"role":"","named_individual":"","reports_to":"","department":"","source":""}],
    "bios":[{"name":"","role":"","allocation":"","bio":"","source":""}]
  },
  "case_studies": [{"client":"","situation":"","action":"","result":"","source":""}],
  "references_note": "",
  "commercial": {
    "fee_options":[{"structure":"Time & Materials","detail":"","indicative_fee":"","source":""}],
    "expenses_policy":"",
    "margin_check":"",
    "requires_partner_approval": true
  },
  "risks": {
    "client_dependencies":[{"item":"","source":""}],
    "mitigations":[{"risk":"","mitigation":"","source":""}]
  },
  "sources_used": [""],
  "open_questions_for_partner": [""]
}

Rules — the first is absolute:
1. EVERY claim carries a source. source must be an engagement id such as ENG-001,
   or "RFP". If you cannot source a statement, write "UNSOURCED — partner to verify".
   Never leave a source blank and never invent an id.
2. sources_used must list every id referenced anywhere. A later gate reads this list.
3. lead_department and every phase's/governance role's department: name only a
   department from firm_context.departments — never invent one. Pick based on the
   RFP's sector against each department's "covers" description; reasoning states
   that match in one sentence. Cross-sector delivery work within a phase (e.g. data
   analysis supporting a healthcare engagement) may use "Cross-Sector Delivery &
   Shared Services" for that phase even when lead_department is sector-specific.
4. cover.logo_note: state plainly that this tool holds no logo assets and a partner
   must insert both firm and client logos before this goes out — never invent a
   description of a logo that doesn't exist.
5. understanding.in_scope / out_of_scope: derive directly from the RFP's stated
   scope items and mandatory requirements. out_of_scope exists to prevent scope
   creep — name things a reasonable bidder could assume are included but are not
   stated in the RFP, or that fall in firm_context.outside_capability.
6. methodology.phases: use exactly these four phase names, in this order, even if
   the RFP describes the engagement differently — map its scope onto them.
7. case_studies: one entry per selected comparable, in Situation-Action-Result
   format. result must quote the comparable's own recorded outcome/results text
   (quantified where the record has a number) — never invent a metric the record
   does not contain. If a comparable was LOST, write that candidly as the result.
8. references_note: this tool has no reference-contact data. Write one sentence
   stating that reference contacts must be supplied by the engagement partner —
   never invent a name, title, or phone/email for a past client contact.
9. team.bios: ~2 short paragraphs each, for partners only from the supplied
   availability list, built on their stated focus/years and on evidence from the
   selected comparables (not invented achievements).
10. commercial.fee_options: include the RFP's preferred commercial structure first;
    you may add one alternative structure the firm also offers, clearly labelled.
    Check every indicative fee against the 38 percent margin floor; state the
    result in margin_check.
11. risks.client_dependencies: concrete, time-bound asks the client must meet
    (e.g. data access within N days, named executive sponsor hours per week).
12. open_questions_for_partner: three to five things you could not resolve.
13. requires_partner_approval is always true.`;
}

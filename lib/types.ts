// Shared types for the VCG Proposal Agent.

export type Engagement = {
  id: string;
  client_id: string;
  company: {
    name: string;
    sector: string;
    sub_sector: string;
    geography: string;
    employees: number;
    annual_revenue_cr: number;
    ownership: string;
  };
  engagement: {
    title: string;
    year: number;
    duration_weeks: number;
    fee_cr: number;
    fee_structure: string;
    team: string;
    scope: string;
  };
  outcome: {
    status: "WON" | "LOST";
    results: string;
    client_satisfaction: string | null;
  };
  win_themes: string[];
  reusable_assets: string[];
  ai_use_permitted: boolean; // drives DP3
  msa_note: string;
};

export type Corpus = {
  corpus_version: string;
  description: string;
  records: Engagement[];
};

export type Criteria = {
  criteria: {
    id: string;
    name: string;
    weight: number;
    anchors: Record<string, string>;
  }[];
  thresholds: { pursue: number; conditional: number };
  escalations: { id: string; rule: string }[];
  firm_context: {
    core_sectors: string[];
    adjacent_sectors: string[];
    outside_capability: string[];
    margin_floor: number;
    blended_day_rate_inr: number;
    departments: { name: string; covers: string }[];
    partners_available: {
      name: string;
      years: number;
      focus: string;
      availability: string;
    }[];
  };
};

// ---- Stage 1: /api/parse ----
export type ParsedRFP = {
  client_name: string | null;
  reference: string | null;
  sector: string | null;
  deadline: string | null;
  engagement_start: string | null;
  duration: string | null;
  budget_range: string | null;
  preferred_commercial_structure: string | null;
  scope_items: string[];
  mandatory_requirements: { ref: string; requirement: string }[];
  evaluation_criteria: { criterion: string; weight: string }[];
  ai_disclosure_required: boolean;
  notable_risks: string[];
};

// ---- Stage 2 + DP1: /api/score ----
export type CriterionScore = {
  id: string;
  criterion: string;
  weight: number;
  score: number;
  contribution: number;
  reasoning: string;
  evidence: string;
};

export type ScoreResult = {
  scores: CriterionScore[];
  weighted_total: number;
  recommendation: "PURSUE" | "PURSUE WITH CONDITIONS" | "DECLINE";
  conditions: string[];
  escalations_triggered: { id: string; rule: string; detail: string }[];
  rationale: string;
  partner_decision_required: boolean;
};

// ---- Stage 3: /api/retrieve (Phase 3) ----
export type RetrieveReason = {
  why_selected: string;
  transferable_assets: string[];
  applicable_win_themes: string[];
  caveats: string;
};

export type ScoredRecord = {
  id: string;
  company: string;
  sector: string;
  title: string;
  outcome: "WON" | "LOST";
  similarity: number;
  ai_use_permitted: boolean;
  // True when ai_use_permitted is false: the record is shown in the ranked
  // list but is not eligible for `selected` (never drafted from).
  excluded_restricted: boolean;
};

export type SelectedRecord = ScoredRecord & {
  record: Engagement;
  reason: RetrieveReason | null; // null if the grounded narrative call failed
};

export type RetrieveResult = {
  query: string;
  selected: SelectedRecord[];
  all_scored: ScoredRecord[];
};

// ---- Stage 4: /api/draft ----
// Nine-section consulting RFP response structure. Every leaf fact still
// carries a `source` (an engagement id such as ENG-001, "RFP", or
// "UNSOURCED — partner to verify") — DP3's CHECK-3 scans the whole object
// for that literal string regardless of shape, so this restructure needs no
// change there.
export type Draft = {
  // Which VCG practice/department owns this engagement — chosen from
  // criteria.firm_context.departments, not invented. Surfaced as its own
  // top-level field (not buried in cover) since it's the answer to a
  // specific partner question: "who does this land on?"
  lead_department: { name: string; reasoning: string; source: string };

  // 1. Cover page & cover letter
  cover: {
    client_name: string;
    firm_name: string;
    reference: string;
    date: string;
    pitch: string; // contextualises the client's challenge, positions VCG
    logo_note: string; // honest placeholder — this tool has no real logo assets
    source: string;
  };

  // 2. Executive summary — current vs. future state, and "why us"
  executive_summary: {
    current_state: string;
    risks_of_inaction: string;
    future_state: string;
    why_us: string;
    source: string;
  };

  // 3. Understanding of the brief & scope assessment
  understanding: {
    root_cause_diagnostic: string; // past the surface symptoms
    in_scope: { item: string; source: string }[];
    out_of_scope: { item: string; source: string }[];
  };

  // 4. Consulting methodology & frameworks
  methodology: {
    phases: {
      phase:
        | "Discovery & Assessment"
        | "Analysis & Diagnostic"
        | "Strategy & Recommendation"
        | "Implementation Support / Enablement";
      weeks: string;
      activities: string;
      output: string;
      department: string; // which VCG department executes this phase
      source: string;
    }[];
    toolkits: { name: string; use: string; source: string }[];
  };

  // 5. Deliverables & project timeline
  timeline: {
    // A text milestone table stands in for a visual Gantt chart — this tool
    // produces a first-draft outline, not a formatted deliverable.
    milestones: { milestone: string; when: string; phase: string; source: string }[];
    deliverables: { name: string; description: string; source: string }[];
  };

  // 6. Engagement team structure & bios
  team: {
    governance: {
      role: string;
      named_individual: string;
      reports_to: string;
      department: string; // which VCG department this role sits in
      source: string;
    }[];
    bios: {
      name: string;
      role: string;
      allocation: string;
      bio: string; // ~2 short paragraphs, grounded in past-engagement evidence
      source: string;
    }[];
  };

  // 7. Qualifications, case studies & references
  case_studies: {
    // Situation-Action-Result, one per selected comparable engagement
    client: string;
    situation: string;
    action: string;
    result: string; // quantified where the record supports it
    source: string;
  }[];
  references_note: string; // never fabricate contact details — says so plainly

  // 8. Commercial proposal & pricing options
  commercial: {
    fee_options: {
      structure: "Time & Materials" | "Fixed Fee / Retainer" | "Value-Based / Success Fee";
      detail: string;
      indicative_fee: string;
      source: string;
    }[];
    expenses_policy: string;
    margin_check: string;
    requires_partner_approval: boolean;
  };

  // 9. Risk management, assumptions & dependencies
  risks: {
    client_dependencies: { item: string; source: string }[];
    mitigations: { risk: string; mitigation: string; source: string }[];
  };

  sources_used: string[];
  open_questions_for_partner: string[];
};

// ---- DP3: /api/check (Phase 4) ----
export type CheckFlag = {
  code:
    | "MSA-UNKNOWN"
    | "MSA-PROHIBITED"
    | "CROSS-CLIENT-RESTRICTED"
    | "UNSOURCED-CLAIMS";
  severity: "BLOCK" | "REVIEW";
  detail: string;
};

// One line per check, always returned (pass or fail) so the UI can show what
// was verified and why, not only what failed.
export type CheckStep = {
  id: "CHECK-1" | "CHECK-2" | "CHECK-3";
  label: string;
  question: string;
  outcome: "PASS" | "REVIEW" | "BLOCK";
  detail: string;
};

export type CheckResult = {
  status: "BLOCKED" | "PASS WITH REVIEW" | "PASS";
  can_proceed: boolean;
  flags: CheckFlag[];
  checks: CheckStep[];
};

// ---- UI ----
export type StageState = "idle" | "running" | "done" | "blocked";

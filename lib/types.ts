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
export type Draft = {
  executive_summary: string;
  win_themes: { theme: string; evidence_source: string }[];
  proposed_approach: {
    phase: string;
    weeks: string;
    activities: string;
    output: string;
    source: string;
  }[];
  team: {
    role: string;
    named_individual: string;
    allocation: string;
    source: string;
  }[];
  credentials_to_cite: { credential: string; source: string }[];
  commercial_recommendation: {
    structure: string;
    indicative_fee: string;
    margin_check: string;
    source: string;
    requires_partner_approval: boolean;
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

export type CheckResult = {
  status: "BLOCKED" | "PASS WITH REVIEW" | "PASS";
  can_proceed: boolean;
  flags: CheckFlag[];
};

// ---- UI ----
export type StageState = "idle" | "running" | "done" | "blocked";

"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SAMPLE_RFPS, type SampleRFP } from "@/lib/sample-rfp";
import type {
  CheckResult,
  Criteria,
  Draft,
  ParsedRFP,
  RetrieveResult,
  ScoreResult,
} from "@/lib/types";

/* ───────────────────────── pipeline model ───────────────────────── */

type NodeKey =
  | "parse"
  | "qualify"
  | "ha1"
  | "retrieve"
  | "draft"
  | "dp3"
  | "output";
type NodeState = "idle" | "running" | "done" | "blocked";

type TabId =
  | "setup"
  | "parse"
  | "qualify"
  | "approval"
  | "retrieve"
  | "draft"
  | "gate";

const TABS: { id: TabId; step: string; label: string; gate?: boolean }[] = [
  { id: "setup", step: "", label: "Setup" },
  { id: "parse", step: "1", label: "Parse" },
  { id: "qualify", step: "2", label: "Qualify" },
  { id: "approval", step: "", label: "Approval", gate: true },
  { id: "retrieve", step: "3", label: "Retrieve" },
  { id: "draft", step: "4", label: "Draft" },
  { id: "gate", step: "", label: "Gate", gate: true },
];

const EXPLAIN: Record<TabId, { what: string; why: string; how: string }> = {
  setup: {
    what: "Choose an RFP and the client it is for, then run qualification.",
    why: "Everything downstream keys off the parsed RFP and the client id.",
    how: "Five prepared RFPs are included; each lands in a different place so you can see what drives the rating.",
  },
  parse: {
    what: "The RFP is read into structured fields — client, budget, scope, mandatory requirements.",
    why: "So scoring and retrieval work from facts, not from prose.",
    how: "One model call. It copies text from the document; it does not infer or improve anything.",
  },
  qualify: {
    what: "The opportunity is scored 1–5 on six weighted criteria, with evidence for every score.",
    why: "A consistent rule set — VCG's own criteria and weights — instead of one person's read.",
    how: "Model call. You supply the criteria, weights and thresholds; it returns scores, reasoning and quotes.",
  },
  approval: {
    what: "The pipeline stops for a named practice partner to approve or decline.",
    why: "A model can recommend. Committing partner time — retrieval, drafting, pricing — is a person's call.",
    how: "No further call is made until Approve is clicked. It is not a timer; the next step is simply not issued.",
  },
  retrieve: {
    what: "Every past engagement is ranked against this RFP by vector similarity.",
    why: "So the draft is built on real comparable work — and you can see it was retrieved, not guessed.",
    how: "RFP and engagements are embedded as vectors; cosine similarity (0–1) is arithmetic. The model only writes the 'why' for the top picks.",
  },
  draft: {
    what: "A first-draft proposal outline, with a source on every line.",
    why: "Nothing goes toward a client that a partner cannot trace to an engagement or to the RFP.",
    how: "Model call, given only the parsed RFP and the selected comparables.",
  },
  gate: {
    what: "Three checks in code decide whether the draft may be released.",
    why: "A rule a model enforces can be talked past by text in its input. A rule in code cannot.",
    how: "No model call. It compares the client's contract, the cited engagements, and the count of unsourced lines.",
  },
};

/* ───────────────────────── helpers ───────────────────────── */

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* status-based error below */
  }
  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : "") || `${url} failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

function recTone(rec?: string): { bg: string; fg: string } {
  if (!rec) return { bg: "var(--line-soft)", fg: "var(--muted)" };
  if (rec.startsWith("PURSUE WITH"))
    return { bg: "var(--review-bg)", fg: "var(--review)" };
  if (rec.startsWith("PURSUE"))
    return { bg: "var(--pass-bg)", fg: "var(--pass)" };
  return { bg: "var(--block-bg)", fg: "var(--block)" };
}
function statusTone(s?: string): { bg: string; fg: string } {
  if (s === "PASS") return { bg: "var(--pass-bg)", fg: "var(--pass)" };
  if (s === "PASS WITH REVIEW")
    return { bg: "var(--review-bg)", fg: "var(--review)" };
  if (s === "BLOCKED") return { bg: "var(--block-bg)", fg: "var(--block)" };
  return { bg: "var(--line-soft)", fg: "var(--muted)" };
}
function outcomeTone(o?: string) {
  return o === "REVIEW"
    ? { bg: "var(--review-bg)", fg: "var(--review)" }
    : o === "BLOCK"
      ? { bg: "var(--block-bg)", fg: "var(--block)" }
      : { bg: "var(--pass-bg)", fg: "var(--pass)" };
}

/* ───────────────────────── shared bits ───────────────────────── */

function Chip({
  children,
  tone,
  strike,
}: {
  children: ReactNode;
  tone?: "src" | "unsourced" | "neutral";
  strike?: boolean;
}) {
  const styles: Record<string, CSSProperties> = {
    src: { background: "#f1ecd2", color: "var(--sky-deep)", borderColor: "#d9cba0" },
    unsourced: {
      background: "var(--block-bg)",
      color: "var(--block)",
      borderColor: "#debab2",
    },
    neutral: {
      background: "var(--line-soft)",
      color: "var(--muted)",
      borderColor: "var(--line)",
    },
  };
  return (
    <span
      className="inline-block rounded border px-1.5 py-0.5 font-mono text-[12px] leading-none"
      style={{
        ...(styles[tone ?? "src"] as CSSProperties),
        textDecoration: strike ? "line-through" : undefined,
      }}
    >
      {children}
    </span>
  );
}

function Pips({ score }: { score: number }) {
  const n = Math.round(score);
  return (
    <span className="inline-flex gap-1" aria-label={`score ${score} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: i <= n ? "var(--olive)" : "var(--line)" }}
        />
      ))}
    </span>
  );
}

function MiniBar({ frac, tone = "olive" }: { frac: number; tone?: "olive" | "sky" }) {
  return (
    <span
      className="block h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--line-soft)" }}
    >
      <span
        className="block h-full rounded-full"
        style={{
          width: `${Math.max(0, Math.min(1, frac)) * 100}%`,
          background: tone === "olive" ? "var(--olive)" : "var(--sky)",
        }}
      />
    </span>
  );
}

function Explain({ tab }: { tab: TabId }) {
  const e = EXPLAIN[tab];
  return (
    <div
      className="mb-4 grid gap-x-6 gap-y-1.5 rounded-lg border px-4 py-3 text-[13.5px] sm:grid-cols-3"
      style={{ background: "var(--card)", borderColor: "var(--line)" }}
    >
      {(
        [
          ["What", e.what],
          ["Why", e.why],
          ["How", e.how],
        ] as const
      ).map(([k, v]) => (
        <div key={k}>
          <span
            className="mr-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--sky-deep)" }}
          >
            {k}
          </span>
          <span style={{ color: "var(--muted)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg border border-dashed p-8 text-center text-[14px]"
      style={{ borderColor: "var(--line)", color: "var(--faint)" }}
    >
      {children}
    </div>
  );
}

function Card({ children, pad = true }: { children: ReactNode; pad?: boolean }) {
  return (
    <div
      className={`rounded-lg border ${pad ? "p-4" : ""}`}
      style={{ background: "var(--card)", borderColor: "var(--line)" }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: "var(--faint)" }}
    >
      {children}
    </p>
  );
}

/* ───────────────────────── main component ───────────────────────── */

export default function Agent({
  clientIds,
  criteria,
}: {
  clientIds: string[];
  criteria: Criteria;
}) {
  const [sampleId, setSampleId] = useState<string>(SAMPLE_RFPS[0].id);
  const [useCustom, setUseCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [clientMode, setClientMode] = useState<string>(() =>
    clientIds.includes(SAMPLE_RFPS[0].clientId)
      ? SAMPLE_RFPS[0].clientId
      : "__new__"
  );
  const [freeClient, setFreeClient] = useState<string>(() =>
    clientIds.includes(SAMPLE_RFPS[0].clientId) ? "" : SAMPLE_RFPS[0].clientId
  );

  const [active, setActive] = useState<TabId>("setup");
  const [node, setNode] = useState<Record<NodeKey, NodeState>>({
    parse: "idle",
    qualify: "idle",
    ha1: "idle",
    retrieve: "idle",
    draft: "idle",
    dp3: "idle",
    output: "idle",
  });
  const [busy, setBusy] = useState(false);

  const [parsed, setParsed] = useState<ParsedRFP | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [retrieval, setRetrieval] = useState<RetrieveResult | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);

  const [approverName, setApproverName] = useState("");
  const [overrideAck, setOverrideAck] = useState(false);
  const [approvedBy, setApprovedBy] = useState<{ name: string; at: string } | null>(
    null
  );
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<{ tab: TabId; message: string } | null>(
    null
  );

  const sample = useMemo(
    () => SAMPLE_RFPS.find((s) => s.id === sampleId) ?? SAMPLE_RFPS[0],
    [sampleId]
  );
  const rfpText = useCustom ? customText : sample.text;
  const effectiveClientId =
    clientMode === "__new__" ? freeClient.trim() : clientMode;
  const canRun =
    rfpText.trim().length >= 20 && effectiveClientId.length > 0 && !busy;

  const awaitingApproval =
    node.ha1 === "running" && !approvedBy && !declined;

  function set(k: NodeKey, s: NodeState) {
    setNode((p) => ({ ...p, [k]: s }));
  }

  function pickSample(s: SampleRFP) {
    setSampleId(s.id);
    setUseCustom(false);
    if (clientIds.includes(s.clientId)) {
      setClientMode(s.clientId);
      setFreeClient("");
    } else {
      setClientMode("__new__");
      setFreeClient(s.clientId);
    }
  }

  function reset() {
    setNode({
      parse: "idle",
      qualify: "idle",
      ha1: "idle",
      retrieve: "idle",
      draft: "idle",
      dp3: "idle",
      output: "idle",
    });
    setParsed(null);
    setScore(null);
    setRetrieval(null);
    setDraft(null);
    setCheck(null);
    setApprovedBy(null);
    setApproverName("");
    setOverrideAck(false);
    setDeclined(false);
    setError(null);
  }

  async function step<T>(k: NodeKey, tab: TabId, fn: () => Promise<T>): Promise<T> {
    set(k, "running");
    try {
      const r = await fn();
      set(k, "done");
      return r;
    } catch (e) {
      set(k, "blocked");
      setError({ tab, message: (e as Error).message });
      throw e;
    }
  }

  // Phase A — parse, qualify, then HALT at HA1. No retrieval/draft/check here.
  async function run() {
    reset();
    setBusy(true);
    setActive("parse");
    try {
      const p = await step("parse", "parse", () =>
        post<{ parsed: ParsedRFP }>("/api/parse", { rfpText })
      );
      setParsed(p.parsed);

      setActive("qualify");
      const s = await step("qualify", "qualify", () =>
        post<ScoreResult>("/api/score", { rfp: p.parsed, clientId: effectiveClientId })
      );
      setScore(s);

      set("ha1", "running"); // hard halt
      setActive("approval");
    } catch {
      /* handled in step() */
    } finally {
      setBusy(false);
    }
  }

  // Phase B — retrieve, draft, gate. Re-entrant: a retry after a transient
  // failure here re-runs from retrieve, but never touches Parse, Qualify or
  // the partner's Approval decision, which are already committed by this point.
  async function runAfterApproval() {
    if (!parsed) return;
    setError(null);
    setBusy(true);
    let atDp3 = false;
    try {
      setActive("retrieve");
      const r = await step("retrieve", "retrieve", () =>
        post<RetrieveResult>("/api/retrieve", { rfp: parsed, topK: 3 })
      );
      setRetrieval(r);

      setActive("draft");
      const d = await step("draft", "draft", () =>
        post<Draft>("/api/draft", { rfp: parsed, selected: r.selected })
      );
      setDraft(d);

      setActive("gate");
      atDp3 = true;
      set("dp3", "running");
      const c = await post<CheckResult>("/api/check", {
        draft: d,
        clientId: effectiveClientId,
        sourcesUsed: d.sources_used ?? [],
      });
      setCheck(c);
      const blocked = c.status === "BLOCKED";
      set("dp3", blocked ? "blocked" : "done");
      set("output", blocked ? "blocked" : "done");
    } catch (e) {
      if (atDp3) {
        set("dp3", "blocked");
        set("output", "blocked");
        setError({ tab: "gate", message: (e as Error).message });
      }
    } finally {
      setBusy(false);
    }
  }

  // Only reachable from the Approve button.
  async function approve() {
    const name = approverName.trim();
    if (!name || !parsed || !score) return;
    // Defense in depth: the button is already disabled client-side until
    // overrideAck is checked, but an override is never approved without it,
    // even if this function were ever called some other way.
    const isOverride =
      score.recommendation === "DECLINE" || score.escalations_triggered.length > 0;
    if (isOverride && !overrideAck) return;
    setApprovedBy({ name, at: new Date().toISOString() });
    set("ha1", "done");
    await runAfterApproval();
  }

  // The error banner's Retry button. Parse/Qualify failures happen before any
  // partner commitment, so retrying them just re-runs from Setup. A failure
  // in Retrieve, Draft or the Gate happens after a partner has already
  // approved — retrying there must not discard that approval, so it resumes
  // Phase B instead of calling run() again.
  function retry() {
    if (!error) return;
    if (error.tab === "parse" || error.tab === "qualify") {
      run();
    } else if (approvedBy) {
      runAfterApproval();
    }
  }

  function decline() {
    setDeclined(true);
    set("ha1", "blocked");
    set("output", "blocked");
  }

  /* tab availability + state */
  function tabState(id: TabId): NodeState | "active" {
    switch (id) {
      case "setup":
        return "active";
      case "parse":
        return node.parse;
      case "qualify":
        return node.qualify;
      case "approval":
        return declined
          ? "blocked"
          : approvedBy
            ? "done"
            : node.ha1 === "running"
              ? "running"
              : "idle";
      case "retrieve":
        return node.retrieve;
      case "draft":
        return node.draft;
      case "gate":
        return node.dp3;
    }
  }
  function tabEnabled(id: TabId): boolean {
    if (id === "setup") return true;
    const st = tabState(id);
    return st !== "idle";
  }

  const dp3Blocked = check?.status === "BLOCKED";

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--bg)" }}>
      {/* ── header ── */}
      <header
        className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3"
        style={{ borderColor: "var(--line)", background: "var(--card)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-8 w-8 place-items-center rounded-md font-mono text-[14px] font-bold text-white"
            style={{ background: "var(--btn)" }}
          >
            V
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-bold">VCG Proposal Agent</p>
            <p className="text-[12px]" style={{ color: "var(--faint)" }}>
              Qualify → a partner approves → retrieve · draft · confidentiality gate
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            setActive("setup");
          }}
          className="rounded-md border px-3 py-1.5 text-[13.5px] font-medium"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Reset
        </button>
      </header>

      {/* ── tab strip ── */}
      <nav
        className="flex shrink-0 gap-1 overflow-x-auto border-b px-4 py-2 scroll-area"
        style={{ borderColor: "var(--line)", background: "var(--card)" }}
      >
        {TABS.map((t) => {
          const st = tabState(t.id);
          const isActive = active === t.id;
          const enabled = tabEnabled(t.id);
          const dot =
            st === "done"
              ? "var(--olive)"
              : st === "running"
                ? "var(--gold)"
                : st === "blocked"
                  ? "var(--block)"
                  : "var(--line)";
          return (
            <button
              key={t.id}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && setActive(t.id)}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13.5px] font-medium transition-colors disabled:opacity-40"
              style={{
                background: isActive ? "var(--mint)" : "transparent",
                color: isActive ? "var(--ink)" : "var(--muted)",
                border: `1px solid ${
                  isActive ? "var(--olive)" : "transparent"
                }`,
                borderStyle: t.gate ? "dashed" : "solid",
              }}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  st === "running" ? "vcg-pulse" : ""
                }`}
                style={{ background: dot }}
              />
              {t.step && (
                <span className="font-mono text-[11px]" style={{ color: "var(--faint)" }}>
                  {t.step}
                </span>
              )}
              <span>{t.label}</span>
              {t.gate && (
                <span
                  className="font-mono text-[10.5px] uppercase tracking-wider"
                  style={{ color: "var(--faint)" }}
                >
                  gate
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── body ── */}
      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-5xl flex-col px-5 py-4">
          <Explain tab={active} />
          {error && error.tab === active && (
            <div
              className="mb-3 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-[13.5px]"
              style={{
                borderColor: "#debab2",
                background: "var(--block-bg)",
                color: "var(--block)",
              }}
            >
              <span className="flex-1">
                {error.message}
                <span className="block text-[12px]" style={{ color: "var(--block)" }}>
                  Usually a transient hiccup, not a problem with the RFP or
                  the decision made — safe to retry.
                </span>
              </span>
              <button
                type="button"
                onClick={retry}
                disabled={busy}
                className="shrink-0 rounded-md border px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40"
                style={{ borderColor: "var(--block)", color: "var(--block)" }}
              >
                Retry
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 scroll-area">
            {active === "setup" && (
              <SetupPanel
                samples={SAMPLE_RFPS}
                sampleId={sampleId}
                pickSample={pickSample}
                useCustom={useCustom}
                setUseCustom={setUseCustom}
                customText={customText}
                setCustomText={setCustomText}
                clientMode={clientMode}
                setClientMode={setClientMode}
                freeClient={freeClient}
                setFreeClient={setFreeClient}
                clientIds={clientIds}
                effectiveClientId={effectiveClientId}
                canRun={canRun}
                busy={busy}
                onRun={run}
              />
            )}
            {active === "parse" &&
              (parsed ? (
                <ParsePanel rfp={parsed} />
              ) : (
                <Placeholder>Run qualification from the Setup tab.</Placeholder>
              ))}
            {active === "qualify" &&
              (score ? (
                <QualifyPanel score={score} criteria={criteria} />
              ) : (
                <Placeholder>The scorecard fills in after Qualify runs.</Placeholder>
              ))}
            {active === "approval" && (
              <ApprovalPanel
                score={score}
                criteria={criteria}
                awaiting={awaitingApproval}
                approvedBy={approvedBy}
                declined={declined}
                name={approverName}
                setName={setApproverName}
                overrideAck={overrideAck}
                setOverrideAck={setOverrideAck}
                onApprove={approve}
                onDecline={decline}
                busy={busy}
              />
            )}
            {active === "retrieve" &&
              (retrieval ? (
                <RetrievePanel data={retrieval} />
              ) : (
                <Placeholder>
                  Retrieval runs after a partner approves at the gate.
                </Placeholder>
              ))}
            {active === "draft" &&
              (draft ? (
                <DraftPanel draft={draft} withheld={!!dp3Blocked} />
              ) : (
                <Placeholder>The draft is written after retrieval.</Placeholder>
              ))}
            {active === "gate" &&
              (check ? (
                <GatePanel check={check} />
              ) : (
                <Placeholder>
                  The confidentiality gate runs last, after the draft.
                </Placeholder>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ───────────────────────── Setup ───────────────────────── */

function SetupPanel(props: {
  samples: SampleRFP[];
  sampleId: string;
  pickSample: (s: SampleRFP) => void;
  useCustom: boolean;
  setUseCustom: (b: boolean) => void;
  customText: string;
  setCustomText: (s: string) => void;
  clientMode: string;
  setClientMode: (s: string) => void;
  freeClient: string;
  setFreeClient: (s: string) => void;
  clientIds: string[];
  effectiveClientId: string;
  canRun: boolean;
  busy: boolean;
  onRun: () => void;
}) {
  const {
    samples,
    sampleId,
    pickSample,
    useCustom,
    setUseCustom,
    customText,
    setCustomText,
    clientMode,
    setClientMode,
    freeClient,
    setFreeClient,
    clientIds,
    effectiveClientId,
    canRun,
    busy,
    onRun,
  } = props;

  return (
    <div className="space-y-5 pb-4">
      <div>
        <SectionLabel>Choose an RFP</SectionLabel>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {samples.map((s) => {
            const on = !useCustom && sampleId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSample(s)}
                className="rounded-lg border p-3 text-left transition-colors"
                style={{
                  background: on ? "var(--mint)" : "var(--card)",
                  borderColor: on ? "var(--olive)" : "var(--line)",
                  boxShadow: on ? "inset 0 0 0 1px var(--olive)" : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold">{s.label}</span>
                  <span
                    className="font-mono text-[12px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {s.budget}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-[11.5px] font-medium"
                    style={{ background: "#f1ecd2", color: "var(--sky-deep)" }}
                  >
                    {s.sector}
                  </span>
                  <span
                    className="font-mono text-[11.5px]"
                    style={{ color: "var(--faint)" }}
                  >
                    {s.clientId}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
                  {s.blurb}
                </p>
                <p
                  className="mt-1.5 border-t pt-1.5 text-[12.5px]"
                  style={{ borderColor: "var(--line-soft)", color: "var(--faint)" }}
                >
                  <span
                    className="font-mono text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--olive-deep)" }}
                  >
                    Expect ·{" "}
                  </span>
                  {s.expect}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setUseCustom(!useCustom)}
          className="text-[13px] font-medium underline"
          style={{ color: "var(--sky-deep)" }}
        >
          {useCustom ? "← Use a prepared RFP" : "Paste a different RFP instead"}
        </button>
        {useCustom && (
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={8}
            placeholder="Paste RFP text here…"
            className="mt-2 w-full resize-y rounded-lg border p-3 font-mono text-[13px] leading-relaxed outline-none"
            style={{ borderColor: "var(--line)", background: "var(--card)" }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <SectionLabel>Client</SectionLabel>
          <div className="flex items-center gap-2">
            <select
              value={clientMode}
              onChange={(e) => setClientMode(e.target.value)}
              className="rounded-md border px-2 py-2 text-[14px] outline-none"
              style={{ borderColor: "var(--line)", background: "var(--card)" }}
            >
              <option value="__new__">New / other client…</option>
              {clientIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            {clientMode === "__new__" && (
              <input
                value={freeClient}
                onChange={(e) => setFreeClient(e.target.value)}
                placeholder="CLI-…"
                className="rounded-md border px-2 py-2 font-mono text-[14px] outline-none"
                style={{ borderColor: "var(--line)", background: "var(--card)" }}
              />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="rounded-md px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--btn)" }}
        >
          {busy ? "Running…" : "Run qualification →"}
        </button>
        <span className="text-[12.5px]" style={{ color: "var(--faint)" }}>
          for <span className="font-mono">{effectiveClientId || "—"}</span>
        </span>
      </div>

      <div
        className="rounded-lg border p-3 text-[13px]"
        style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--muted)" }}
      >
        <span className="font-semibold" style={{ color: "var(--ink)" }}>
          After you run:
        </span>{" "}
        Parse and Qualify complete, then the pipeline{" "}
        <span className="font-semibold" style={{ color: "var(--ink)" }}>
          stops
        </span>{" "}
        at Approval. Nothing is retrieved, drafted, or checked until a named
        partner approves. Decline and it stops there.
      </div>
    </div>
  );
}

/* ───────────────────────── Parse ───────────────────────── */

function DefRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b py-1.5 last:border-0" style={{ borderColor: "var(--line-soft)" }}>
      <span
        className="font-mono text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--faint)" }}
      >
        {k}
      </span>
      <span className="text-[14px]">{v ?? "—"}</span>
    </div>
  );
}

function ParsePanel({ rfp }: { rfp: ParsedRFP }) {
  return (
    <Card>
      <DefRow k="Client" v={rfp.client_name} />
      <DefRow k="Reference" v={<span className="font-mono text-[13px]">{rfp.reference}</span>} />
      <DefRow k="Sector" v={rfp.sector} />
      <DefRow k="Deadline" v={rfp.deadline} />
      <DefRow k="Start" v={rfp.engagement_start} />
      <DefRow k="Duration" v={rfp.duration} />
      <DefRow k="Budget" v={rfp.budget_range} />
      <DefRow k="Preferred structure" v={rfp.preferred_commercial_structure} />
      <DefRow
        k="Scope items"
        v={
          <ul className="list-disc space-y-0.5 pl-4">
            {(rfp.scope_items ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        }
      />
      <DefRow
        k="Mandatory reqs"
        v={
          <ul className="space-y-1">
            {(rfp.mandatory_requirements ?? []).map((m, i) => (
              <li key={i} className="flex gap-2">
                <Chip tone="neutral">{m.ref}</Chip>
                <span>{m.requirement}</span>
              </li>
            ))}
          </ul>
        }
      />
      <DefRow k="AI disclosure required" v={String(rfp.ai_disclosure_required)} />
      <DefRow
        k="Notable risks"
        v={
          <ul className="list-disc space-y-0.5 pl-4">
            {(rfp.notable_risks ?? []).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        }
      />
    </Card>
  );
}

/* ───────────────────────── Qualify ───────────────────────── */

function QualifyPanel({
  score,
  criteria,
}: {
  score: ScoreResult;
  criteria: Criteria;
}) {
  const defaultWeights = useMemo<Record<string, number>>(
    () => Object.fromEntries(criteria.criteria.map((c) => [c.id, c.weight])),
    [criteria]
  );
  const [weights, setWeights] = useState<Record<string, number>>(defaultWeights);

  // A new run replaces `score` wholesale — snap the sliders back to VCG's
  // published weights so a what-if left over from a previous RFP can't be
  // mistaken for this one's default. Reset during render (React's documented
  // pattern for "state tied to a prop"), not in an effect — that avoids an
  // extra post-mount render just to discard the stale weights.
  const [prevScore, setPrevScore] = useState(score);
  if (score !== prevScore) {
    setPrevScore(score);
    setWeights(defaultWeights);
  }

  const weightSum =
    Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const adjusted = score.scores.map((c) => {
    const rawWeight = weights[c.id] ?? c.weight;
    const normWeight = rawWeight / weightSum;
    return { ...c, adjWeight: normWeight, adjContribution: c.score * normWeight };
  });
  const adjustedTotal = adjusted.reduce((s, c) => s + c.adjContribution, 0);
  const isAdjusted = criteria.criteria.some(
    (c) => Math.abs((weights[c.id] ?? 0) - c.weight) > 0.001
  );
  const adjRecommendation: ScoreResult["recommendation"] =
    score.escalations_triggered.length > 0
      ? score.recommendation // an escalation overrides the score regardless of weights
      : adjustedTotal >= criteria.thresholds.pursue
        ? "PURSUE"
        : adjustedTotal >= criteria.thresholds.conditional
          ? "PURSUE WITH CONDITIONS"
          : "DECLINE";

  const displayTotal = isAdjusted ? adjustedTotal : score.weighted_total;
  const displayRecommendation = isAdjusted ? adjRecommendation : score.recommendation;
  const tone = recTone(displayRecommendation);

  const anchorFor = (cid: string, s: number) => {
    const c = criteria.criteria.find((x) => x.id === cid);
    if (!c) return { band: "—", text: "" };
    const band = s >= 4 ? "5" : s >= 2 ? "3" : "1";
    return { band, text: c.anchors[band] ?? "" };
  };

  return (
    <div className="space-y-4 pb-4">
      {/* weight sliders — what-if, client-side only */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Adjust criteria weights — what-if, no AI call</SectionLabel>
          {isAdjusted && (
            <button
              type="button"
              onClick={() => setWeights(defaultWeights)}
              className="rounded-md border px-2.5 py-1 text-[12px] font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--sky-deep)" }}
            >
              Reset to VCG defaults
            </button>
          )}
        </div>
        <div className="mt-2 space-y-2.5">
          {criteria.criteria.map((c) => {
            const raw = weights[c.id] ?? c.weight;
            const normPct = ((raw / weightSum) * 100).toFixed(0);
            return (
              <div key={c.id} className="grid grid-cols-[150px_1fr_52px] items-center gap-3">
                <span className="truncate text-[13px]" title={c.name}>
                  {c.name}
                </span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={Math.round(raw * 100)}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [c.id]: Number(e.target.value) / 100 }))
                  }
                  className="w-full accent-[var(--olive)]"
                  aria-label={`${c.name} weight`}
                />
                <span className="tnum text-right text-[13px] font-semibold">
                  {normPct}%
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px]" style={{ color: "var(--faint)" }}>
          Sliders re-normalise to 100% automatically, so they never need to add
          up by hand. This recalculates the arithmetic above instantly — it
          does not call the model again, and it does not change the
          recommendation a partner sees at Approval, which always uses VCG&apos;s
          published weights below.
        </p>
      </Card>

      {/* stat tiles */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
            Weighted total {isAdjusted && <span style={{ color: "var(--sky-deep)" }}>· adjusted</span>}
          </p>
          <p className="mt-1 tnum text-[30px] font-extrabold leading-none">
            {displayTotal.toFixed(2)}
            <span className="text-[15px] font-medium" style={{ color: "var(--faint)" }}>
              {" "}
              / 5.00
            </span>
          </p>
          <div className="relative mt-3 h-2 w-full rounded-full" style={{ background: "var(--line-soft)" }}>
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${(displayTotal / 5) * 100}%`, background: "var(--olive)" }}
            />
            {[
              { v: criteria.thresholds.conditional, l: "conditional" },
              { v: criteria.thresholds.pursue, l: "pursue" },
            ].map((t) => (
              <div
                key={t.l}
                className="absolute -top-1 h-4 w-px"
                style={{ left: `${(t.v / 5) * 100}%`, background: "var(--ink)" }}
                title={`${t.l} ≥ ${t.v}`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--faint)" }}>
            ticks: conditional ≥ {criteria.thresholds.conditional} · pursue ≥{" "}
            {criteria.thresholds.pursue}
            {isAdjusted && (
              <>
                {" "}
                · VCG official:{" "}
                <span className="tnum font-semibold">{score.weighted_total.toFixed(2)}</span>
              </>
            )}
          </p>
        </Card>
        <Card>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
            Recommendation {isAdjusted && <span style={{ color: "var(--sky-deep)" }}>· adjusted</span>}
          </p>
          <span
            className="mt-2 inline-block rounded-md px-2.5 py-1.5 text-[14px] font-bold"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {displayRecommendation}
          </span>
          <p className="mt-2 text-[12px]" style={{ color: "var(--faint)" }}>
            {isAdjusted
              ? `VCG official (published weights): ${score.recommendation}`
              : "a recommendation, not a decision"}
          </p>
        </Card>
        <Card>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
            Escalations
          </p>
          <p className="mt-1 tnum text-[30px] font-extrabold leading-none">
            {score.escalations_triggered.length}
            <span className="text-[15px] font-medium" style={{ color: "var(--faint)" }}>
              {" "}
              / 4 triggered
            </span>
          </p>
          <p className="mt-2 text-[12px]" style={{ color: "var(--faint)" }}>
            an escalation overrides the score — weights can&apos;t move it
          </p>
        </Card>
      </div>

      {/* build-up bar */}
      <Card>
        <SectionLabel>How the total is built — contribution by criterion</SectionLabel>
        <div className="relative mt-1 flex h-7 w-full overflow-hidden rounded-md" style={{ background: "var(--line-soft)" }}>
          {adjusted.map((c, i) => (
            <div
              key={c.id}
              className="grid place-items-center border-r-2 text-[11px] font-semibold text-white"
              style={{
                width: `${(c.adjContribution / 5) * 100}%`,
                background: i % 2 ? "var(--sky-deep)" : "var(--olive)",
                borderColor: "var(--card)",
              }}
              title={`${c.id} ${c.criterion}: ${c.adjContribution.toFixed(2)}`}
            >
              {c.adjContribution >= 0.35 ? c.id : ""}
            </div>
          ))}
          {[criteria.thresholds.conditional, criteria.thresholds.pursue].map((v) => (
            <div
              key={v}
              className="pointer-events-none absolute top-0 h-full w-0.5"
              style={{ left: `${(v / 5) * 100}%`, background: "var(--ink)" }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11.5px]" style={{ color: "var(--faint)" }}>
          <span>0.00</span>
          <span>
            sum = <span className="tnum font-semibold" style={{ color: "var(--ink)" }}>{displayTotal.toFixed(2)}</span>
          </span>
          <span>5.00</span>
        </div>
      </Card>

      {/* per-criterion detail */}
      <div className="space-y-2.5">
        <SectionLabel>Each score, and what it was graded against</SectionLabel>
        {adjusted.map((c) => {
          const a = anchorFor(c.id, c.score);
          const maxContribution = 5 * c.adjWeight;
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Chip tone="neutral">{c.id}</Chip>
                  <span className="text-[14px] font-bold">{c.criterion}</span>
                  <span className="text-[12px]" style={{ color: "var(--faint)" }}>
                    weight {(c.adjWeight * 100).toFixed(0)}%
                    {isAdjusted && (
                      <span style={{ color: "var(--sky-deep)" }}>
                        {" "}
                        (was {(c.weight * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Pips score={c.score} />
                  <span className="tnum text-[13px] font-semibold">{c.score} / 5</span>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-[13.5px] sm:grid-cols-[110px_1fr]">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                  Benchmark {a.band}
                </span>
                <span style={{ color: "var(--muted)" }}>{a.text}</span>

                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                  Why this score
                </span>
                <span>{c.reasoning}</span>

                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                  Evidence
                </span>
                <span className="italic" style={{ color: "var(--muted)" }}>
                  {c.evidence ? `“${c.evidence}”` : "—"}
                </span>

                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                  Contribution
                </span>
                <span>
                  <span className="tnum">
                    {c.score} × {c.adjWeight.toFixed(2)} ={" "}
                    <span className="font-semibold">{c.adjContribution.toFixed(2)}</span>
                  </span>
                  <span className="mt-1 block max-w-[240px]">
                    <MiniBar frac={c.adjContribution / maxContribution} tone="olive" />
                  </span>
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* escalations */}
      <div>
        <SectionLabel>Escalation rules — all four are checked</SectionLabel>
        <div className="space-y-1.5">
          {criteria.escalations.map((e) => {
            const hit = score.escalations_triggered.find((x) => x.id === e.id);
            return (
              <div
                key={e.id}
                className="flex gap-2 rounded-md border px-3 py-2 text-[13.5px]"
                style={{
                  borderColor: hit ? "#debab2" : "var(--line)",
                  background: hit ? "var(--block-bg)" : "var(--card)",
                }}
              >
                <span style={{ color: hit ? "var(--block)" : "var(--olive-deep)" }}>
                  {hit ? "▲" : "✓"}
                </span>
                <span>
                  <span className="font-mono text-[12px] font-semibold">{e.id}</span>{" "}
                  {e.rule}
                  {hit?.detail && (
                    <span className="block text-[12.5px]" style={{ color: "var(--block)" }}>
                      {hit.detail}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* rationale + conditions */}
      <Card>
        <SectionLabel>Rationale — for a partner with thirty seconds</SectionLabel>
        <p className="text-[14px]">{score.rationale}</p>
        {score.conditions?.length > 0 && (
          <>
            <p className="mt-3 font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
              Conditions
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13.5px]" style={{ color: "var(--muted)" }}>
              {score.conditions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* default-weight basis, outside the interactive card */}
      <p className="pt-1 text-[12px]" style={{ color: "var(--faint)" }}>
        Default weights — sector fit {(criteria.criteria.find((c) => c.id === "C1")?.weight ?? 0) * 100}%, capability
        fit {(criteria.criteria.find((c) => c.id === "C2")?.weight ?? 0) * 100}%, competitive
        position {(criteria.criteria.find((c) => c.id === "C3")?.weight ?? 0) * 100}%, commercial
        viability {(criteria.criteria.find((c) => c.id === "C4")?.weight ?? 0) * 100}%, capacity &
        mobilisation {(criteria.criteria.find((c) => c.id === "C5")?.weight ?? 0) * 100}%, conflict &
        risk {(criteria.criteria.find((c) => c.id === "C6")?.weight ?? 0) * 100}% — are VCG&apos;s published
        pursuit-qualification weights (<code>data/criteria.json</code>), set by the
        partnership, not by this agent. The sliders above let you explore how
        the recommendation would shift if a given pursuit should weigh these
        differently; they recompute the arithmetic on this page only, with no
        new AI call, and never change the criteria or the weights VCG actually
        uses at the Approval gate.
      </p>
    </div>
  );
}

/* ───────────────────────── Approval ───────────────────────── */

function ApprovalPanel(props: {
  score: ScoreResult | null;
  criteria: Criteria;
  awaiting: boolean;
  approvedBy: { name: string; at: string } | null;
  declined: boolean;
  name: string;
  setName: (s: string) => void;
  overrideAck: boolean;
  setOverrideAck: (b: boolean) => void;
  onApprove: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const {
    score,
    criteria,
    awaiting,
    approvedBy,
    declined,
    name,
    setName,
    overrideAck,
    setOverrideAck,
    onApprove,
    onDecline,
    busy,
  } = props;
  const roster = criteria.firm_context.partners_available;

  if (approvedBy) {
    return (
      <div
        className="rounded-lg border p-5 text-[14px]"
        style={{ borderColor: "var(--olive)", background: "var(--pass-bg)", color: "var(--pass)" }}
      >
        Approved by <strong>{approvedBy.name}</strong> at{" "}
        <span className="font-mono">{approvedBy.at}</span>.<br />
        Judgement retained; the work was delegated.
      </div>
    );
  }
  if (declined) {
    return (
      <div
        className="rounded-lg border p-5 text-[14px]"
        style={{ borderColor: "#debab2", background: "var(--block-bg)", color: "var(--block)" }}
      >
        Pursuit declined. No further partner time consumed.
      </div>
    );
  }
  if (!awaiting || !score) {
    return <Placeholder>The approval gate appears once qualification is done.</Placeholder>;
  }
  const tone = recTone(score.recommendation);
  const { pursue, conditional } = criteria.thresholds;
  const sortedByContribution = [...score.scores].sort(
    (a, b) => b.contribution - a.contribution
  );
  const strongest = sortedByContribution.slice(0, 2);
  const weakest = sortedByContribution[sortedByContribution.length - 1];
  const escalations = score.escalations_triggered;
  const hasEscalation = escalations.length > 0;
  const clearsPursue = score.weighted_total >= pursue;
  const clearsConditional = score.weighted_total >= conditional;
  const isOverride = score.recommendation === "DECLINE" || hasEscalation;
  const canApprove = name.trim().length > 0 && !busy && (!isOverride || overrideAck);

  return (
    <div
      className="rounded-lg border-2 p-5"
      style={{ borderColor: "var(--sky-deep)", background: "#f1ecd2" }}
    >
      <p className="font-mono text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--sky-deep)" }}>
        Awaiting practice partner approval
      </p>
      <p className="mt-3 text-[14px]">
        Recommendation{" "}
        <span className="rounded px-1.5 py-0.5 text-[13px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
          {score.recommendation}
        </span>{" "}
        · weighted score <span className="tnum font-semibold">{score.weighted_total.toFixed(2)}</span>
        <span className="text-[13px]" style={{ color: "var(--faint)" }}>
          {" "}
          / 5.00
        </span>
      </p>
      <p className="mt-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
        Six criteria, each scored 1–5 by the model and multiplied by VCG&apos;s
        published weight, summed to this one number. Full per-criterion detail
        is on the <span className="font-semibold">Qualify</span> tab — the
        headline reasons are below.
      </p>

      {score.rationale && (
        <p
          className="mt-3 rounded-md border-l-4 px-3 py-2 text-[13.5px] italic"
          style={{ borderColor: "var(--sky-deep)", background: "var(--card)", color: "var(--ink)" }}
        >
          “{score.rationale}”
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-md border p-3"
          style={{ borderColor: "var(--olive)", background: "var(--pass-bg)" }}
        >
          <p
            className="font-mono text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--pass)" }}
          >
            Basis to approve
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px]" style={{ color: "var(--ink)" }}>
            <li>
              Weighted total {score.weighted_total.toFixed(2)}{" "}
              {clearsPursue
                ? `clears the pursue line (≥ ${pursue.toFixed(2)}).`
                : clearsConditional
                  ? `clears the conditional line (≥ ${conditional.toFixed(2)}), below pursue.`
                  : `is below the conditional line (${conditional.toFixed(2)}).`}
            </li>
            {strongest.map((c) => (
              <li key={c.id}>
                <span className="font-semibold">
                  {c.criterion} ({c.score}/5, {(c.weight * 100).toFixed(0)}% weight)
                </span>
                {c.reasoning ? ` — ${c.reasoning}` : ""}
              </li>
            ))}
            {!hasEscalation && <li>No escalation rule has fired.</li>}
          </ul>
        </div>

        <div
          className="rounded-md border p-3"
          style={{
            borderColor: hasEscalation ? "var(--block)" : "var(--line)",
            background: hasEscalation ? "var(--block-bg)" : "var(--card)",
          }}
        >
          <p
            className="font-mono text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: hasEscalation ? "var(--block)" : "var(--faint)" }}
          >
            Basis to decline
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px]" style={{ color: "var(--ink)" }}>
            {hasEscalation ? (
              escalations.map((e) => (
                <li key={e.id}>
                  <span className="font-semibold">
                    {e.id} triggered
                  </span>{" "}
                  — {e.rule}
                  {e.detail ? `: ${e.detail}` : ""}. An escalation overrides the
                  score.
                </li>
              ))
            ) : (
              <li>No escalation rule triggered — nothing overrides the score.</li>
            )}
            <li>
              <span className="font-semibold">
                {weakest.criterion} ({weakest.score}/5, {(weakest.weight * 100).toFixed(0)}% weight)
              </span>
              {weakest.reasoning ? ` — ${weakest.reasoning}` : ""} — the weakest
              criterion in this scorecard.
            </li>
            {!clearsConditional && (
              <li>
                Weighted total is below the conditional line (
                {conditional.toFixed(2)}) — the model recommends decline.
              </li>
            )}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-[13.5px]" style={{ color: "var(--muted)" }}>
        The pipeline has stopped. It will not retrieve, draft, price or contact
        anyone until a named partner decides. This is a recommendation, not a
        decision — the partner can approve or decline against this evidence
        either way.
      </p>

      {isOverride && (
        <div
          className="mt-3 rounded-md border-2 p-3"
          style={{ borderColor: "var(--block)", background: "var(--block-bg)" }}
        >
          <p className="text-[13.5px] font-semibold" style={{ color: "var(--block)" }}>
            {score.recommendation === "DECLINE"
              ? "The model recommends DECLINE."
              : `${escalations.length} escalation rule${escalations.length > 1 ? "s" : ""} fired.`}{" "}
            Approving goes against that.
          </p>
          <label className="mt-2 flex items-start gap-2 text-[13px]" style={{ color: "var(--ink)" }}>
            <input
              type="checkbox"
              checked={overrideAck}
              onChange={(e) => setOverrideAck(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have read the basis above and am approving this pursuit{" "}
              <span className="font-semibold">against</span>{" "}
              {score.recommendation === "DECLINE" ? "the model's recommendation" : "a triggered escalation"}
              , on my own authority as the named partner.
            </span>
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <select
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setOverrideAck(false);
          }}
          className="min-w-64 rounded-md border px-2.5 py-2 text-[14px] outline-none"
          style={{ borderColor: "var(--line)", background: "var(--card)" }}
        >
          <option value="">Select approving partner…</option>
          {roster.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} — {p.focus} ({p.availability} available)
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onApprove}
          disabled={!canApprove}
          className="rounded-md px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--olive-deep)" }}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          className="rounded-md border px-4 py-2 text-[14px] font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--block)", color: "var(--block)" }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Retrieve ───────────────────────── */

function RetrievePanel({ data }: { data: RetrieveResult }) {
  const selIds = new Set(data.selected.map((s) => s.id));
  const sims = data.all_scored.map((r) => r.similarity);
  const lo = Math.min(...sims) - 0.005;
  const hi = Math.max(...sims) + 0.005;
  const frac = (v: number) => (hi === lo ? 0.5 : (v - lo) / (hi - lo));

  return (
    <div className="space-y-4 pb-4">
      <Card pad={false}>
        <div className="border-b px-4 py-2.5 text-[12.5px]" style={{ borderColor: "var(--line-soft)", color: "var(--muted)" }}>
          All 12 engagements, ranked. Bars scaled {lo.toFixed(2)}–{hi.toFixed(2)} for
          contrast; the raw cosine value is shown alongside.
        </div>
        <div className="divide-y" style={{ borderColor: "var(--line-soft)" }}>
          {data.all_scored.map((r, i) => {
            const sel = selIds.has(r.id);
            return (
              <div
                key={r.id}
                className="grid grid-cols-[26px_92px_1fr_120px] items-center gap-3 px-4 py-2 text-[13px]"
                style={{
                  background: sel ? "var(--mint)" : undefined,
                  borderLeft: sel ? "3px solid var(--olive)" : "3px solid transparent",
                  opacity: r.excluded_restricted ? 0.55 : 1,
                }}
              >
                <span className="tnum font-mono text-[12px]" style={{ color: "var(--faint)" }}>
                  {i + 1}
                </span>
                <span
                  className="font-mono text-[12px] font-semibold"
                  style={{ color: sel ? "var(--olive-deep)" : "var(--ink)" }}
                >
                  {r.id}
                </span>
                <span className="min-w-0">
                  <span
                    className="block truncate"
                    style={{
                      textDecoration: r.excluded_restricted ? "line-through" : undefined,
                    }}
                  >
                    {r.company}
                  </span>
                  <span className="text-[11.5px]" style={{ color: "var(--faint)" }}>
                    {r.sector} · {r.outcome}
                    {r.excluded_restricted && (
                      <span
                        className="ml-1.5 rounded px-1 py-0.5 text-[10.5px] font-semibold uppercase"
                        style={{ background: "var(--block-bg)", color: "var(--block)" }}
                      >
                        MSA — not eligible
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--line-soft)" }}>
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${frac(r.similarity) * 100}%`,
                        background: sel ? "var(--olive)" : "var(--sky)",
                      }}
                    />
                  </span>
                  <span className="tnum font-mono text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {r.similarity.toFixed(4)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="space-y-2.5">
        <SectionLabel>Selected comparables — grounded in the record</SectionLabel>
        {data.selected.map((s) => (
          <Card key={s.id}>
            <p className="text-[14px] font-bold">
              <span className="font-mono text-[13px]" style={{ color: "var(--olive-deep)" }}>
                {s.id}
              </span>{" "}
              {s.record.company.name} — {s.record.engagement.title}{" "}
              <span className="font-mono text-[12px]" style={{ color: "var(--faint)" }}>
                sim {s.similarity.toFixed(4)}
              </span>
            </p>
            {s.reason ? (
              <div className="mt-2 space-y-1.5 text-[13.5px]" style={{ color: "var(--muted)" }}>
                <p>{s.reason.why_selected}</p>
                {s.reason.transferable_assets?.length > 0 && (
                  <p>
                    <span className="font-semibold" style={{ color: "var(--ink)" }}>
                      Transferable assets:{" "}
                    </span>
                    {s.reason.transferable_assets.join("; ")}
                  </p>
                )}
                {s.reason.applicable_win_themes?.length > 0 && (
                  <p>
                    <span className="font-semibold" style={{ color: "var(--ink)" }}>
                      Applicable win themes:{" "}
                    </span>
                    {s.reason.applicable_win_themes.join("; ")}
                  </p>
                )}
                {s.reason.caveats && <p className="italic">Caveats: {s.reason.caveats}</p>}
              </div>
            ) : (
              <p className="mt-2 text-[13px] italic" style={{ color: "var(--faint)" }}>
                Grounded narrative unavailable (model call failed or quota). The
                similarity score stands.
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Draft ───────────────────────── */

function srcTone(s: string) {
  return /UNSOURCED/i.test(s || "") ? "unsourced" : "src";
}

function DraftPanel({ draft, withheld }: { draft: Draft; withheld: boolean }) {
  return (
    <div className="space-y-3 pb-4">
      {withheld && (
        <div
          className="rounded-lg border-2 px-4 py-3 text-[13px] font-bold uppercase tracking-wide"
          style={{ borderColor: "var(--block)", background: "var(--block-bg)", color: "var(--block)" }}
        >
          Draft withheld — the gate blocked release. Shown here for the reviewing
          partner only.
        </div>
      )}
      <div className={withheld ? "pointer-events-none opacity-45" : ""}>
        <Card>
          <SectionLabel>Executive summary</SectionLabel>
          <p className="text-[14px]">{draft.executive_summary}</p>

          <SectionLabel>
            <span className="mt-4 block">Win themes</span>
          </SectionLabel>
          <ul className="space-y-1 text-[13.5px]">
            {(draft.win_themes ?? []).map((w, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span>{w.theme}</span>
                <Chip tone={srcTone(w.evidence_source)}>{w.evidence_source}</Chip>
              </li>
            ))}
          </ul>

          <SectionLabel>
            <span className="mt-4 block">Proposed approach</span>
          </SectionLabel>
          <div className="space-y-1.5">
            {(draft.proposed_approach ?? []).map((p, i) => (
              <div
                key={i}
                className="rounded-md border p-2 text-[13.5px]"
                style={{ borderColor: "var(--line-soft)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.phase}</span>
                  <span className="font-mono text-[12px]" style={{ color: "var(--faint)" }}>
                    {p.weeks}
                  </span>
                  <Chip tone={srcTone(p.source)}>{p.source}</Chip>
                </div>
                <p className="mt-1" style={{ color: "var(--muted)" }}>
                  {p.activities}
                </p>
                <p className="mt-0.5 italic" style={{ color: "var(--faint)" }}>
                  Output: {p.output}
                </p>
              </div>
            ))}
          </div>

          <SectionLabel>
            <span className="mt-4 block">Team</span>
          </SectionLabel>
          <ul className="space-y-1 text-[13.5px]">
            {(draft.team ?? []).map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span>
                  {t.role}: <strong>{t.named_individual}</strong> ({t.allocation})
                </span>
                <Chip tone={srcTone(t.source)}>{t.source}</Chip>
              </li>
            ))}
          </ul>

          <SectionLabel>
            <span className="mt-4 block">Credentials to cite</span>
          </SectionLabel>
          <ul className="space-y-1 text-[13.5px]">
            {(draft.credentials_to_cite ?? []).map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span>{c.credential}</span>
                <Chip tone={srcTone(c.source)}>{c.source}</Chip>
              </li>
            ))}
          </ul>

          <SectionLabel>
            <span className="mt-4 block">Commercial recommendation</span>
          </SectionLabel>
          <div className="text-[13.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <span>{draft.commercial_recommendation?.structure}</span>
              <span className="font-mono text-[12px]">
                {draft.commercial_recommendation?.indicative_fee}
              </span>
              <Chip tone={srcTone(draft.commercial_recommendation?.source ?? "")}>
                {draft.commercial_recommendation?.source}
              </Chip>
            </div>
            <p className="mt-1" style={{ color: "var(--muted)" }}>
              Margin check: {draft.commercial_recommendation?.margin_check}
            </p>
          </div>

          <SectionLabel>
            <span className="mt-4 block">Sources used</span>
          </SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {(draft.sources_used ?? []).map((s, i) => (
              <Chip key={i} tone={srcTone(s)}>
                {s}
              </Chip>
            ))}
          </div>

          <SectionLabel>
            <span className="mt-4 block">Open questions for partner</span>
          </SectionLabel>
          <ul className="list-disc space-y-0.5 pl-4 text-[13.5px]" style={{ color: "var(--muted)" }}>
            {(draft.open_questions_for_partner ?? []).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── Gate (DP3) ───────────────────────── */

function GatePanel({ check }: { check: CheckResult }) {
  const tone = statusTone(check.status);
  return (
    <div className="space-y-3 pb-4">
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border-2 px-4 py-3"
        style={{ borderColor: tone.fg, background: tone.bg }}
      >
        <span className="text-[16px] font-extrabold" style={{ color: tone.fg }}>
          {check.status}
        </span>
        <span className="text-[13px]" style={{ color: tone.fg }}>
          can_proceed = <span className="font-mono font-semibold">{String(check.can_proceed)}</span>
        </span>
        <span className="ml-auto text-[12px]" style={{ color: "var(--faint)" }}>
          ran in code · no model call
        </span>
      </div>

      {check.status === "BLOCKED" && (
        <p
          className="rounded-md border-2 px-3 py-2 text-[13.5px] font-semibold"
          style={{ borderColor: "var(--block)", background: "var(--block-bg)", color: "var(--block)" }}
        >
          Draft withheld and escalated. This gate is deterministic code, not a
          prompt — it cannot be talked past, including by instructions placed in
          the RFP.
        </p>
      )}

      <div className="space-y-2">
        {check.checks.map((c) => {
          const t = outcomeTone(c.outcome);
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--faint)" }}>
                  {c.id}
                </span>
                <span className="text-[14px] font-bold">{c.label}</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase"
                  style={{ background: t.bg, color: t.fg }}
                >
                  {c.outcome}
                </span>
              </div>
              <p className="mt-1 text-[13px]" style={{ color: "var(--faint)" }}>
                {c.question}
              </p>
              <p className="mt-1.5 text-[13.5px]">{c.detail}</p>
            </Card>
          );
        })}
      </div>

      {check.flags.length > 0 && (
        <div>
          <SectionLabel>Flags raised</SectionLabel>
          <div className="space-y-1.5">
            {check.flags.map((f, i) => (
              <div
                key={i}
                className="rounded-md border px-3 py-2 text-[13px]"
                style={{
                  borderColor: f.severity === "BLOCK" ? "#debab2" : "#e7d6a0",
                  background: f.severity === "BLOCK" ? "var(--block-bg)" : "var(--review-bg)",
                }}
              >
                <span className="font-mono font-bold">{f.code}</span>{" "}
                <span
                  className="rounded px-1 py-0.5 text-[10.5px] font-bold text-white"
                  style={{ background: f.severity === "BLOCK" ? "var(--block)" : "var(--review)" }}
                >
                  {f.severity}
                </span>
                <p className="mt-1" style={{ color: "var(--muted)" }}>
                  {f.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

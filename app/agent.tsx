"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { SAMPLE_RFP, SAMPLE_CLIENT_ID } from "@/lib/sample-rfp";
import type {
  CheckResult,
  Draft,
  ParsedRFP,
  RetrieveResult,
  ScoreResult,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Pipeline nodes
// ---------------------------------------------------------------------------

type NodeKey =
  | "intake"
  | "parse"
  | "qualify"
  | "dp1"
  | "ha1"
  | "retrieve"
  | "draft"
  | "dp3"
  | "output";

type NodeState = "idle" | "running" | "done" | "blocked";

const NODES: { key: NodeKey; label: string; kind: "stage" | "decision" | "gate" }[] =
  [
    { key: "intake", label: "1 Intake", kind: "stage" },
    { key: "parse", label: "2 Parse", kind: "stage" },
    { key: "qualify", label: "3 Qualify", kind: "stage" },
    { key: "dp1", label: "DP1", kind: "decision" },
    { key: "ha1", label: "HA1 GATE", kind: "gate" },
    { key: "retrieve", label: "4 Retrieve", kind: "stage" },
    { key: "draft", label: "5 Draft", kind: "stage" },
    { key: "dp3", label: "DP3 GATE", kind: "gate" },
    { key: "output", label: "Output", kind: "stage" },
  ];

const ALL_IDLE = Object.fromEntries(
  NODES.map((n) => [n.key, "idle" as NodeState])
) as Record<NodeKey, NodeState>;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

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
    /* fall through to status-based error */
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

const NAVY = "#14324f";

function recColor(rec?: string): string {
  if (!rec) return "#6b7280";
  if (rec.startsWith("PURSUE WITH")) return "#b45309"; // amber
  if (rec.startsWith("PURSUE")) return "#15803d"; // green
  return "#b91c1c"; // DECLINE — red
}

function statusColor(status?: string): string {
  if (status === "PASS") return "#15803d";
  if (status === "PASS WITH REVIEW") return "#b45309";
  if (status === "BLOCKED") return "#b91c1c";
  return "#6b7280";
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

function SourceChip({ source }: { source: string }) {
  const unsourced = /UNSOURCED/i.test(source);
  return (
    <span
      className="inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none"
      style={
        unsourced
          ? { borderColor: "#b91c1c", color: "#b91c1c", background: "#fef2f2" }
          : { borderColor: "#cbd5e1", color: NAVY, background: "#f8fafc" }
      }
      title={source}
    >
      {source}
    </span>
  );
}

function Section({
  title,
  open,
  children,
}: {
  title: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      className="border-b border-neutral-200 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="cursor-pointer list-none select-none py-4 text-sm font-semibold text-neutral-900">
        {title}
      </summary>
      <div className="pb-6 text-sm text-neutral-700">{children}</div>
    </details>
  );
}

function PipelineStrip({ state }: { state: Record<NodeKey, NodeState> }) {
  return (
    <div className="flex flex-wrap items-stretch gap-1.5">
      {NODES.map((n, i) => {
        const s = state[n.key];
        const base =
          "flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap transition-colors";
        const shape =
          n.kind === "stage"
            ? "rounded border"
            : n.kind === "decision"
              ? "rounded-none border-2 border-dashed italic"
              : "rounded-none border-2 uppercase tracking-wide font-semibold";
        const tone =
          s === "running"
            ? "vcg-running"
            : s === "done"
              ? ""
              : s === "blocked"
                ? ""
                : "";
        const style: CSSProperties =
          s === "done"
            ? { borderColor: "#15803d", color: "#15803d", background: "#f0fdf4" }
            : s === "running"
              ? { borderColor: NAVY, color: NAVY, background: "#eef4f9" }
              : s === "blocked"
                ? {
                    borderColor: "#b91c1c",
                    color: "#b91c1c",
                    background: "#fef2f2",
                  }
                : { borderColor: "#d4d4d4", color: "#9ca3af", background: "#fff" };
        return (
          <div key={n.key} className="flex items-center gap-1.5">
            <div className={`${base} ${shape} ${tone}`} style={style}>
              {s === "done" && <span aria-hidden>✓</span>}
              {s === "blocked" && <span aria-hidden>✕</span>}
              {s === "running" && <span aria-hidden>●</span>}
              <span>{n.label}</span>
            </div>
            {i < NODES.length - 1 && (
              <span className="text-neutral-300" aria-hidden>
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Agent({ clientIds }: { clientIds: string[] }) {
  const [rfpText, setRfpText] = useState("");
  const [clientMode, setClientMode] = useState<string>("__new__");
  const [freeClient, setFreeClient] = useState("");

  const [nodeState, setNodeState] =
    useState<Record<NodeKey, NodeState>>(ALL_IDLE);
  const [busy, setBusy] = useState(false);

  const [parsed, setParsed] = useState<ParsedRFP | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [retrieval, setRetrieval] = useState<RetrieveResult | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);

  const [approverName, setApproverName] = useState("");
  const [approvedBy, setApprovedBy] = useState<{ name: string; at: string } | null>(
    null
  );
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<{ node: NodeKey; message: string } | null>(
    null
  );

  const effectiveClientId =
    clientMode === "__new__" ? freeClient.trim() : clientMode;

  const awaitingApproval =
    nodeState.ha1 === "running" && !approvedBy && !declined;

  const canRun =
    rfpText.trim().length >= 20 && effectiveClientId.length > 0 && !busy;

  function setNode(key: NodeKey, s: NodeState) {
    setNodeState((prev) => ({ ...prev, [key]: s }));
  }

  function loadSample() {
    setRfpText(SAMPLE_RFP);
    setClientMode("__new__");
    setFreeClient(SAMPLE_CLIENT_ID);
  }

  function resetRun() {
    setNodeState(ALL_IDLE);
    setParsed(null);
    setScore(null);
    setRetrieval(null);
    setDraft(null);
    setCheck(null);
    setApprovedBy(null);
    setApproverName("");
    setDeclined(false);
    setError(null);
  }

  async function step<T>(node: NodeKey, fn: () => Promise<T>): Promise<T> {
    setNode(node, "running");
    try {
      const r = await fn();
      setNode(node, "done");
      return r;
    } catch (e) {
      setNode(node, "blocked");
      setError({ node, message: (e as Error).message });
      throw e;
    }
  }

  // Phase A: Intake -> Parse -> Qualify -> DP1, then HALT at HA1.
  // No retrieval/draft/check call is issued here. The pipeline will not
  // continue until onApprove() runs from a real button click.
  async function runToApproval() {
    resetRun();
    setBusy(true);
    try {
      setNode("intake", "done");
      const p = await step("parse", () =>
        post<{ parsed: ParsedRFP }>("/api/parse", { rfpText })
      );
      setParsed(p.parsed);

      const s = await step("qualify", () =>
        post<ScoreResult>("/api/score", { rfp: p.parsed })
      );
      setScore(s);

      setNode("dp1", "done"); // decision point presented
      setNode("ha1", "running"); // <-- HARD HALT. Awaiting a human.
    } catch {
      /* handled in step() */
    } finally {
      setBusy(false);
    }
  }

  // Phase B: only reachable from the Approve button.
  async function onApprove() {
    const name = approverName.trim();
    if (!name || !parsed) return;
    setApprovedBy({ name, at: new Date().toISOString() });
    setNode("ha1", "done");
    setBusy(true);
    let atDp3 = false;
    try {
      const r = await step("retrieve", () =>
        post<RetrieveResult>("/api/retrieve", { rfp: parsed, topK: 3 })
      );
      setRetrieval(r);

      const d = await step("draft", () =>
        post<Draft>("/api/draft", { rfp: parsed, selected: r.selected })
      );
      setDraft(d);

      // DP3 — a BLOCKED verdict is a normal 200 response, not an error.
      atDp3 = true;
      setNode("dp3", "running");
      const c = await post<CheckResult>("/api/check", {
        draft: d,
        clientId: effectiveClientId,
        sourcesUsed: d.sources_used ?? [],
      });
      setCheck(c);
      if (c.status === "BLOCKED") {
        setNode("dp3", "blocked");
        setNode("output", "blocked");
      } else {
        setNode("dp3", "done");
        setNode("output", "done");
      }
    } catch (e) {
      if (atDp3) {
        setNode("dp3", "blocked");
        setNode("output", "blocked");
        setError({ node: "dp3", message: (e as Error).message });
      }
      /* retrieve/draft errors already handled in step() */
    } finally {
      setBusy(false);
    }
  }

  function onDecline() {
    setDeclined(true);
    setNode("ha1", "blocked");
    setNode("output", "blocked");
  }

  const draftWithheld = check?.status === "BLOCKED";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
          Vertex Consulting Group
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
          Proposal Agent
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          An RFP is parsed, scored against VCG&apos;s pursuit criteria, and then{" "}
          <strong>held for a practice partner</strong>. Only after approval does
          it retrieve comparable engagements by vector similarity, draft a
          sourced outline, and run a deterministic confidentiality gate that can
          block release.
        </p>
      </header>

      {/* ---------- ZONE A — INPUT ---------- */}
      <section className="mb-8">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          RFP text
        </label>
        <textarea
          value={rfpText}
          onChange={(e) => setRfpText(e.target.value)}
          rows={8}
          placeholder="Paste the RFP text, or click Load sample RFP."
          className="w-full resize-y rounded border border-neutral-300 p-3 font-mono text-xs leading-relaxed text-neutral-800 outline-none focus:border-[color:var(--navy)]"
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Client
            </label>
            <select
              value={clientMode}
              onChange={(e) => setClientMode(e.target.value)}
              className="rounded border border-neutral-300 bg-white px-2 py-2 text-sm text-neutral-800 outline-none focus:border-[color:var(--navy)]"
            >
              <option value="__new__">New / other client…</option>
              {clientIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          {clientMode === "__new__" && (
            <input
              value={freeClient}
              onChange={(e) => setFreeClient(e.target.value)}
              placeholder="e.g. CLI-MERIDIAN-NEW"
              className="rounded border border-neutral-300 px-2 py-2 font-mono text-sm text-neutral-800 outline-none focus:border-[color:var(--navy)]"
            />
          )}
          <button
            type="button"
            onClick={loadSample}
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Load sample RFP
          </button>
          <button
            type="button"
            onClick={runToApproval}
            disabled={!canRun}
            className="rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: NAVY }}
          >
            {busy && !awaitingApproval ? "Running…" : "Run Agent"}
          </button>
        </div>
      </section>

      {/* ---------- ZONE B — PIPELINE ---------- */}
      <section className="mb-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
          Pipeline
        </p>
        <PipelineStrip state={nodeState} />
        {error && (
          <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="font-mono font-semibold">{error.node}</span> failed:{" "}
            {error.message}
          </p>
        )}
      </section>

      {/* ---------- ZONE C — OUTPUT ---------- */}
      <section className="border-t border-neutral-200">
        {/* Parsed RFP */}
        <Section title="Parsed RFP structure" open={!!parsed}>
          {parsed ? <ParsedView rfp={parsed} /> : <Empty />}
        </Section>

        {/* Scorecard */}
        <Section title="Qualification scorecard  ·  DP1" open={!!score}>
          {score ? <Scorecard score={score} /> : <Empty />}
        </Section>

        {/* Approval gate */}
        <Section
          title="Practice partner approval  ·  HA1"
          open={awaitingApproval || !!approvedBy || declined}
        >
          {awaitingApproval && score && (
            <div
              className="rounded border-2 p-5"
              style={{ borderColor: NAVY, background: "#eef4f9" }}
            >
              <p
                className="font-mono text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: NAVY }}
              >
                Awaiting practice partner approval
              </p>
              <p className="mt-3 text-sm text-neutral-700">
                Recommendation:{" "}
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-white"
                  style={{ background: recColor(score.recommendation) }}
                >
                  {score.recommendation}
                </span>{" "}
                &nbsp;·&nbsp; Weighted score:{" "}
                <span className="font-mono font-semibold">
                  {score.weighted_total.toFixed(2)}
                </span>
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                The pipeline has stopped. It will not retrieve, draft, price or
                contact anyone until a named partner decides.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="Type your name to enable the decision"
                  className="min-w-64 rounded border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-[color:var(--navy)]"
                />
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={!approverName.trim() || busy}
                  className="rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "#15803d" }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={onDecline}
                  disabled={busy}
                  className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  style={{ borderColor: "#b91c1c", color: "#b91c1c" }}
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {approvedBy && (
            <div className="rounded border border-green-300 bg-green-50 p-4 text-sm text-green-800">
              Approved by <strong>{approvedBy.name}</strong> at{" "}
              <span className="font-mono">{approvedBy.at}</span>. Judgement
              retained; work delegated.
            </div>
          )}

          {declined && (
            <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              Pursuit declined. No further partner time consumed.
            </div>
          )}

          {!awaitingApproval && !approvedBy && !declined && <Empty />}
        </Section>

        {/* Retrieval */}
        <Section
          title="Retrieval  ·  12 engagements ranked by vector similarity"
          open={!!retrieval}
        >
          {retrieval ? <RetrievalView data={retrieval} /> : <Empty />}
        </Section>

        {/* Draft */}
        <Section title="Draft outline" open={!!draft}>
          {draft ? (
            <DraftView draft={draft} withheld={draftWithheld} />
          ) : (
            <Empty />
          )}
        </Section>

        {/* DP3 */}
        <Section title="Confidentiality gate  ·  DP3 (deterministic)" open={!!check}>
          {check ? <DP3View check={check} /> : <Empty />}
        </Section>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Output sub-views
// ---------------------------------------------------------------------------

function Empty() {
  return <p className="text-xs text-neutral-400">Not run yet.</p>;
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-3 py-1">
      <span className="w-56 shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {k}
      </span>
      <span className="text-sm text-neutral-800">{v ?? "—"}</span>
    </div>
  );
}

function ParsedView({ rfp }: { rfp: ParsedRFP }) {
  return (
    <div className="divide-y divide-neutral-100">
      <Row k="Client" v={rfp.client_name} />
      <Row k="Reference" v={<span className="font-mono text-xs">{rfp.reference}</span>} />
      <Row k="Sector" v={rfp.sector} />
      <Row k="Deadline" v={rfp.deadline} />
      <Row k="Engagement start" v={rfp.engagement_start} />
      <Row k="Duration" v={rfp.duration} />
      <Row k="Budget range" v={rfp.budget_range} />
      <Row
        k="Preferred commercial structure"
        v={rfp.preferred_commercial_structure}
      />
      <Row
        k="Scope items"
        v={
          <ul className="list-disc pl-5">
            {(rfp.scope_items ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        }
      />
      <Row
        k="Mandatory requirements"
        v={
          <ul className="space-y-1">
            {(rfp.mandatory_requirements ?? []).map((m, i) => (
              <li key={i}>
                <span className="mr-2 rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px]">
                  {m.ref}
                </span>
                {m.requirement}
              </li>
            ))}
          </ul>
        }
      />
      <Row
        k="AI disclosure required"
        v={String(rfp.ai_disclosure_required)}
      />
      <Row
        k="Notable risks"
        v={
          <ul className="list-disc pl-5">
            {(rfp.notable_risks ?? []).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        }
      />
    </div>
  );
}

function Scorecard({ score }: { score: ScoreResult }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-3">Criterion</th>
              <th className="py-2 pr-3">Weight</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2 pr-3">Contribution</th>
              <th className="py-2">Reasoning &amp; evidence</th>
            </tr>
          </thead>
          <tbody>
            {score.scores.map((c) => (
              <tr
                key={c.id}
                className="border-b border-neutral-100 align-top"
              >
                <td className="py-2 pr-3">
                  <span className="font-mono text-xs text-neutral-500">
                    {c.id}
                  </span>{" "}
                  {c.criterion}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {c.weight.toFixed(2)}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{c.score}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {c.contribution.toFixed(2)}
                </td>
                <td className="py-2 text-xs text-neutral-600">
                  {c.reasoning}
                  {c.evidence ? (
                    <span className="mt-0.5 block italic text-neutral-400">
                      {c.evidence}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          Weighted total
        </span>
        <span className="font-mono text-3xl font-semibold text-neutral-900">
          {score.weighted_total.toFixed(2)}
        </span>
        <span
          className="rounded px-2 py-1 font-mono text-xs font-semibold text-white"
          style={{ background: recColor(score.recommendation) }}
        >
          {score.recommendation}
        </span>
      </div>

      {score.escalations_triggered?.length > 0 && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">Escalations triggered</p>
          <ul className="mt-1 list-disc pl-5">
            {score.escalations_triggered.map((e, i) => (
              <li key={i}>
                <span className="font-mono">{e.id}</span> — {e.rule}
                {e.detail ? `: ${e.detail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {score.conditions?.length > 0 && (
        <div className="mt-3 text-xs text-neutral-600">
          <p className="font-semibold uppercase tracking-wide text-neutral-500">
            Conditions
          </p>
          <ul className="mt-1 list-disc pl-5">
            {score.conditions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-sm text-neutral-700">{score.rationale}</p>
    </div>
  );
}

function RetrievalView({ data }: { data: RetrieveResult }) {
  const selectedIds = new Set(data.selected.map((s) => s.id));
  return (
    <div>
      <p className="mb-2 text-xs text-neutral-500">
        Query embedded:{" "}
        <span className="font-mono">{data.query.replace(/\s+/g, " ").slice(0, 160)}…</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">Company</th>
              <th className="py-2 pr-3">Sector</th>
              <th className="py-2 pr-3">Outcome</th>
              <th className="py-2">Similarity</th>
            </tr>
          </thead>
          <tbody>
            {data.all_scored.map((r, i) => {
              const isSel = selectedIds.has(r.id);
              return (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100"
                  style={
                    isSel
                      ? { background: "#eef4f9" }
                      : r.excluded_restricted
                        ? { color: "#9ca3af" }
                        : undefined
                  }
                >
                  <td className="py-2 pr-3 font-mono text-xs">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <span
                      className="font-mono text-xs"
                      style={isSel ? { color: NAVY, fontWeight: 700 } : undefined}
                    >
                      {r.id}
                    </span>
                  </td>
                  <td
                    className={`py-2 pr-3 ${
                      r.excluded_restricted ? "line-through" : ""
                    }`}
                  >
                    {r.company}
                  </td>
                  <td className="py-2 pr-3 text-xs">{r.sector}</td>
                  <td className="py-2 pr-3 text-xs">
                    {r.outcome}
                    {r.excluded_restricted && (
                      <span className="ml-2 rounded border border-neutral-300 bg-neutral-100 px-1 py-0.5 text-[10px] uppercase text-neutral-500">
                        MSA — not eligible
                      </span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs">
                    {r.similarity.toFixed(4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 space-y-4">
        {data.selected.map((s) => (
          <div key={s.id} className="rounded border border-neutral-200 p-4">
            <p className="text-sm font-semibold text-neutral-900">
              <span className="font-mono text-xs" style={{ color: NAVY }}>
                {s.id}
              </span>{" "}
              {s.record.company.name} — {s.record.engagement.title}{" "}
              <span className="font-mono text-xs text-neutral-400">
                sim {s.similarity.toFixed(4)}
              </span>
            </p>
            {s.reason ? (
              <div className="mt-2 space-y-2 text-xs text-neutral-700">
                <p>{s.reason.why_selected}</p>
                {s.reason.transferable_assets?.length > 0 && (
                  <p>
                    <span className="font-semibold">Transferable assets: </span>
                    {s.reason.transferable_assets.join("; ")}
                  </p>
                )}
                {s.reason.applicable_win_themes?.length > 0 && (
                  <p>
                    <span className="font-semibold">Applicable win themes: </span>
                    {s.reason.applicable_win_themes.join("; ")}
                  </p>
                )}
                {s.reason.caveats && (
                  <p className="italic text-neutral-500">
                    Caveats: {s.reason.caveats}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs italic text-neutral-400">
                Grounded narrative unavailable (model call failed or quota).
                Similarity score stands.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftView({ draft, withheld }: { draft: Draft; withheld: boolean }) {
  return (
    <div className="relative">
      {withheld && (
        <div className="mb-3 rounded border-2 border-red-400 bg-red-50 p-3 text-xs font-semibold uppercase tracking-wide text-red-700">
          Draft withheld — DP3 blocked release. Shown for the reviewing partner
          only.
        </div>
      )}
      <div className={withheld ? "pointer-events-none opacity-40" : ""}>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Executive summary
        </p>
        <p className="mt-1 text-sm text-neutral-800">{draft.executive_summary}</p>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Win themes
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {(draft.win_themes ?? []).map((w, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span>{w.theme}</span>
              <SourceChip source={w.evidence_source} />
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Proposed approach
        </p>
        <div className="mt-1 space-y-2">
          {(draft.proposed_approach ?? []).map((p, i) => (
            <div key={i} className="rounded border border-neutral-200 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.phase}</span>
                <span className="font-mono text-xs text-neutral-500">
                  {p.weeks}
                </span>
                <SourceChip source={p.source} />
              </div>
              <p className="mt-1 text-xs text-neutral-600">{p.activities}</p>
              <p className="mt-0.5 text-xs italic text-neutral-500">
                Output: {p.output}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Team
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {(draft.team ?? []).map((t, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span>
                {t.role}: <strong>{t.named_individual}</strong> ({t.allocation})
              </span>
              <SourceChip source={t.source} />
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Credentials to cite
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {(draft.credentials_to_cite ?? []).map((c, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span>{c.credential}</span>
              <SourceChip source={c.source} />
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Commercial recommendation
        </p>
        <div className="mt-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>{draft.commercial_recommendation?.structure}</span>
            <span className="font-mono text-xs">
              {draft.commercial_recommendation?.indicative_fee}
            </span>
            <SourceChip source={draft.commercial_recommendation?.source ?? ""} />
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Margin check: {draft.commercial_recommendation?.margin_check}
          </p>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Sources used
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {(draft.sources_used ?? []).map((s, i) => (
            <SourceChip key={i} source={s} />
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Open questions for partner
        </p>
        <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
          {(draft.open_questions_for_partner ?? []).map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DP3View({ check }: { check: CheckResult }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="rounded px-2 py-1 font-mono text-xs font-bold uppercase tracking-wide text-white"
          style={{ background: statusColor(check.status) }}
        >
          {check.status}
        </span>
        <span className="text-xs text-neutral-500">
          can_proceed ={" "}
          <span className="font-mono">{String(check.can_proceed)}</span>
        </span>
      </div>

      {check.status === "BLOCKED" && (
        <p className="mt-3 rounded border-2 border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-700">
          Draft withheld and escalated. This gate is deterministic code, not a
          prompt — it cannot be talked past.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {check.flags.length === 0 && (
          <li className="text-xs text-neutral-500">
            No flags. Clean pass.
          </li>
        )}
        {check.flags.map((f, i) => (
          <li
            key={i}
            className="rounded border p-3 text-xs"
            style={{
              borderColor: f.severity === "BLOCK" ? "#fca5a5" : "#fcd34d",
              background: f.severity === "BLOCK" ? "#fef2f2" : "#fffbeb",
            }}
          >
            <span className="mr-2 font-mono font-bold">{f.code}</span>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white"
              style={{
                background: f.severity === "BLOCK" ? "#b91c1c" : "#b45309",
              }}
            >
              {f.severity}
            </span>
            <p className="mt-1 text-neutral-700">{f.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

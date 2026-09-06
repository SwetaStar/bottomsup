// Phase 1 placeholder. The interactive pipeline UI is built in Phase 5.
// Kept intentionally plain so an early Vercel deploy renders something real.

const STAGES = [
  "1 Intake",
  "2 Parse",
  "3 Qualify",
  "DP1",
  "HA1 GATE",
  "4 Retrieve",
  "5 Draft",
  "DP3 GATE",
  "Output",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-8 py-20">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-[#1e3a5f]">
          Vertex Consulting Group
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">
          VCG Proposal Agent
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-neutral-600">
          A governed AI agent: parse an RFP, score it against VCG&apos;s pursuit
          criteria, <strong>halt for practice-partner approval</strong>, retrieve
          comparable engagements by vector similarity, draft a sourced outline,
          and run a deterministic confidentiality gate that can block release.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Pipeline
        </h2>
        <ol className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <li
              key={s}
              className="rounded border border-neutral-300 bg-neutral-50 px-3 py-1.5 font-mono text-xs text-neutral-500"
            >
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
        <p className="font-medium text-neutral-900">Build status: Phase 3 complete</p>
        <p className="mt-1">
          Reasoning on Gemini{" "}
          <code className="font-mono text-xs">gemini-3.5-flash-lite</code>,
          embeddings on{" "}
          <code className="font-mono text-xs">gemini-embedding-001</code>, one
          server-side <code className="font-mono text-xs">GEMINI_API_KEY</code>.
          Routes:{" "}
          <code className="font-mono text-xs">/api/parse</code>,{" "}
          <code className="font-mono text-xs">/api/score</code>,{" "}
          <code className="font-mono text-xs">/api/retrieve</code> (12 records
          ranked by cosine similarity, top 3 with grounded narrative),{" "}
          <code className="font-mono text-xs">/api/draft</code>. The DP3 gate
          (Phase 4) and the interactive UI (Phase 5) are next.
        </p>
      </section>
    </main>
  );
}

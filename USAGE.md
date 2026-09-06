# Using the VCG Proposal Agent

**Live:** https://bottomsup.vercel.app — public link, nothing to install, no login.
Runs on a shared free-tier model, so treat any RFP you paste as non-confidential.
All client and engagement data is fictional.

Illustrated version of this guide:
https://claude.ai/code/artifact/3b6c014e-7d5d-4b46-b4d5-908186f6d20c

---

## What it does

An RFP arrives. The agent parses it, scores it against VCG's six pursuit
criteria, then **stops for a practice partner**. Only after a human approves does
it retrieve comparable past engagements by vector similarity, draft a
fully-sourced outline, and run a deterministic confidentiality gate that can
refuse to release the draft. It does not bid, price, or send anything.

## The screen

One page, seven horizontal tabs — no long scrolling. The tabs are the pipeline;
each carries a status dot (grey = not run, gold pulse = running, olive = done,
red = blocked) and advances on its own. You can click back to any completed tab
to review it. Every tab has a **What / Why / How** band at the top.

`Setup → 1 Parse → 2 Qualify → Approval (gate) → 3 Retrieve → 4 Draft → Gate (gate)`

## Run it

1. **Setup** — pick one of the five prepared RFPs (each card says what to expect),
   or click *Paste a different RFP instead*. The client id fills in from the
   preset; change it if you want. Click **Run qualification →**.
2. **Parse / Qualify** run, then the pipeline **stops** at **Approval**.
3. **Qualify** tab — read the scorecard (see below), then go to **Approval**.
4. **Approval** — type your name (buttons stay disabled until you do), then
   **Approve** or **Decline**. Approve records "Approved by [name] at [time]".
5. **Retrieve / Draft / Gate** run. The **Gate** tab shows the verdict.

## The Qualify tab — every number is explained

- Three tiles: **weighted total** (out of 5, with tick marks at the conditional
  ≥ 2.8 and pursue ≥ 3.6 thresholds), the **recommendation**, and how many of the
  four **escalation** rules fired.
- **How the total is built** — a single bar split into the six criteria's
  contributions, so you can see which criteria carry the score.
- One card per criterion, showing: its **weight**; the **score** (1–5) as pips;
  the **benchmark** it was graded against (VCG's own anchor text for that band);
  **why this score**; the **evidence** quote; and the arithmetic
  `score × weight = contribution` with a bar.
- All four **escalation rules** listed — triggered (▲, red) or clear (✓). A
  triggered escalation overrides the score.

## The Gate tab — DP3, deterministic

Shows the verdict (`PASS` / `PASS WITH REVIEW` / `BLOCKED`) and then **all three
checks**, pass or fail, each with the question it asked and what it found:

1. **Client permission** — is the client's contract on file, and does it permit
   AI tooling? Unknown client → REVIEW. Contract forbids it → BLOCK.
2. **Cross-client contamination** — does the draft build on any past engagement
   whose contract bars AI tooling? → BLOCK if so.
3. **Unsourced claims** — any line marked `UNSOURCED`? → REVIEW if so.

No model call runs here. A rule a model enforces can be talked past by text in
its input; a rule in code cannot.

## The five prepared RFPs

| RFP | Where it lands |
|---|---|
| **Meridian Health Systems** | Core sector, clean scope, good budget → high score, **pursue**. New client → gate returns **PASS WITH REVIEW**. |
| **Brightfold Retail** | Retail is an *adjacent* sector, so sector-fit is capped mid-range → borderline, **pursue with conditions**. |
| **Kestrel Diagnostics** | Work fits, but the RFP demands unlimited liability and a below-benchmark price → **escalation rules fire** and override the score. |
| **Pinnacle Legal Advisory** | Litigation support / clinical protocol design are outside VCG capability; ₹15 lakh is below profitable delivery → low total, **decline**. |
| **Vela Financial Services** | Strong on the scorecard — core sector, clean scope. But Vela's 2021 MSA forbids AI tooling → the gate returns **BLOCKED**, draft withheld. |

## Three things to try

| Scenario | Do | Result |
|---|---|---|
| **Clean run** | Meridian, Approve | End to end. Draft has a source chip on every line. Gate = PASS WITH REVIEW. |
| **Decline** | Meridian, click Decline at Approval | "Pursuit declined. No further partner time consumed." Open the network tab — no retrieve/draft/check request is sent. |
| **Block** | Vela, Approve | Gate = BLOCKED, `MSA-PROHIBITED`, draft withheld. Deterministic — no RFP wording talks past it. |

## If something looks wrong

- **A tab dot turns red with a "quota" message** — the free-tier model has a
  daily cap. Wait for the reset, or set `GEMINI_MODEL` in the Vercel project to
  another model. Reset and re-run.
- **The weighted total moves a little between runs** — temperature is low, not
  zero. The recommendation is stable; the number can shift a tenth or two.
- **Run qualification is greyed out** — you need ~20+ chars of RFP text and a
  client id.
- **Nothing happens after Approve** — the name field must have text.

## Under the hood

One Next.js app. Five pipeline steps are separate server routes called in
sequence (`/api/parse`, `/api/score`, `/api/retrieve`, `/api/draft`,
`/api/check`). Reasoning: `gemini-3.5-flash-lite`. Retrieval embeds the 12-record
library with `gemini-embedding-001` and ranks by cosine similarity in memory — no
database. The API key is server-side only. `/api/check` makes no model call.

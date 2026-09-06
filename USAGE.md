# Using the VCG Proposal Agent

**Live:** https://bottomsup.vercel.app — public link, nothing to install, no login.
Runs on a shared free-tier model, so treat any RFP you paste as non-confidential.
All client and engagement data is fictional.

A fuller, illustrated version of this guide:
https://claude.ai/code/artifact/3b6c014e-7d5d-4b46-b4d5-908186f6d20c

---

## What it does

An RFP lands. The agent parses it, scores it against VCG's six pursuit criteria,
then **stops for a practice partner**. Only after a human approves does it
retrieve comparable past engagements by vector similarity, draft a fully-sourced
outline, and run a deterministic confidentiality gate that can refuse to release
the draft. It does not bid, price, or send anything.

## The one rule

After the scorecard appears, the agent has made **no further calls** — nothing
retrieved, drafted, or checked. It is waiting at **HA1 GATE**. Type a name and
click **Approve** to continue, or **Decline** to stop for good. This is not a
timed pause; the next step is never issued until the button is pressed.

## Run it, step by step (~1 minute)

1. **Load an RFP** — click `Load sample RFP`, or paste your own text (min ~20 chars).
2. **Pick the client** — dropdown of known client ids, or leave on *New / other
   client…* and type one. The sample loads with `CLI-MERIDIAN-NEW`.
3. **Click Run Agent** — Intake, Parse, Qualify turn green; the Parsed RFP and
   Qualification scorecard panels fill in.
4. **Read the scorecard** — six criteria with weight, score, contribution and
   evidence; a weighted total; a recommendation (`PURSUE` / `PURSUE WITH
   CONDITIONS` / `DECLINE`). The pipeline is now stopped.
5. **Approve or decline** — in the *AWAITING PRACTICE PARTNER APPROVAL* card,
   type your name (buttons stay disabled until you do), then click **Approve**.
   It records "Approved by [name] at [timestamp]".
6. **Watch retrieval, draft, gate** — Retrieve ranks all 12 engagements and picks
   the top 3 eligible; Draft writes an outline with a source chip on every line;
   **DP3 GATE** returns `PASS`, `PASS WITH REVIEW`, or `BLOCKED`.

## The six output panels

| Panel | Stage | What's in it |
|---|---|---|
| Parsed RFP | 2 | RFP as structured fields; mandatory requirements M1–M5 |
| Qualification scorecard | 3 · DP1 | 6 criteria scored 1–5, `contribution = score × weight`, weighted total, escalations |
| Practice partner approval | HA1 | The halt — recommendation, score, name field, decision record |
| Retrieval | 4 | All 12 engagements ranked by cosine similarity; top 3 highlighted; MSA-restricted records shown struck through |
| Draft outline | 5 | Sourced outline; every claim has a chip (`ENG-001`, `RFP`, or red `UNSOURCED`) |
| Confidentiality gate | DP3 | Three code checks, no model; status + flags |

## Three things to try

| Scenario | Setup | Result |
|---|---|---|
| **Clean run** | sample RFP, `CLI-MERIDIAN-NEW`, Approve | Runs end to end. `PASS WITH REVIEW` + `MSA-UNKNOWN` (new client, no contract on file). |
| **Decline** | same, click Decline at the gate | "Pursuit declined. No further partner time consumed." Open the network tab first — no retrieve/draft/check request is ever sent. |
| **Block** | sample RFP, client `CLI-VELA`, Approve | `BLOCKED` + `MSA-PROHIBITED` — Vela's 2021 MSA forbids third-party automated processing. Draft withheld. The gate is code, not a prompt; no RFP wording talks past it. |

## Gate outcomes

- **PASS** — no flags; cleared for partner review.
- **PASS WITH REVIEW** — no blockers, but a flag needs a human eye
  (`MSA-UNKNOWN`, `UNSOURCED-CLAIMS`). Draft shown.
- **BLOCKED** — client contract prohibits AI tooling (`MSA-PROHIBITED`), or the
  draft cites an engagement whose contract does (`CROSS-CLIENT-RESTRICTED`).
  Draft withheld and escalated.

## If something looks wrong

- **Red stage, "quota" message** — the free-tier model has a daily request cap.
  Wait for reset, or set `GEMINI_MODEL` in the Vercel project to another model.
  Re-run from the top.
- **Score just above threshold but recommendation is PURSUE WITH CONDITIONS** —
  the model being conservative when real conditions exist. Flows through normally.
- **Weighted total moves a little between runs** — temperature is low, not zero.
  The recommendation is stable; the number can shift a tenth or two.
- **Run Agent greyed out** — needs ~20+ chars of RFP text and a client id.
- **Nothing happens after Approve** — the name field must have text.

## Under the hood

One Next.js app. Five pipeline steps are separate server routes called in
sequence (`/api/parse`, `/api/score`, `/api/retrieve`, `/api/draft`,
`/api/check`). Reasoning: `gemini-3.5-flash-lite`. Retrieval embeds the 12-record
library with `gemini-embedding-001` and ranks by cosine similarity in memory — no
database. The API key is server-side only. `/api/check` has no model call — three
comparisons in code, because a rule enforced by a model can be overridden by text
in its input and a rule enforced by code cannot.

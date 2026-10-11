// Gemini client + callGemini helper. SERVER-SIDE ONLY.
//
// The API key is read from process.env.GEMINI_API_KEY, set as a Vercel
// Environment Variable in production (and optionally in .env.local for local
// dev). It is never exposed to the browser and never prefixed with NEXT_PUBLIC_.
//
// Model note: SPEC named a Claude model. We use Gemini (user decision).
// New Gemini API keys can only use the 3.x line (2.x / 2.0 now 404 with
// "no longer available"). Among 3.x, gemini-3.6-flash returned a hard
// free-tier limit of 20 requests/day on this key; gemini-3.5-flash-lite is
// Google's "high-volume automation" tier and is the default here. Override
// with the GEMINI_MODEL env var (no code change) if quota/availability shifts.

import { GoogleGenAI } from "@google/genai";

export const REASONING_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
export const EMBEDDING_DIMS = 1536;

let client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it as a Vercel Environment Variable " +
        "(or to .env.local for local development)."
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

type CallOptions = {
  prompt: string;
  /** SPEC said 2000 / 4000 (for Claude). Kept generous here as headroom. */
  maxOutputTokens?: number;
  /** SPEC: temperature 0.2. */
  temperature?: number;
};

/** Turn a Gemini SDK error into a short, user-facing message. */
function friendlyGeminiError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes('"code":429')) {
    const retry = msg.match(/retry in ([\d.]+)s/i)?.[1];
    return new Error(
      `Gemini free-tier quota reached for model ${REASONING_MODEL}.` +
        (retry ? ` Retry in ~${Math.ceil(Number(retry))}s.` : "") +
        " Set GEMINI_MODEL to a model with more free quota, or wait for the daily reset."
    );
  }
  if (
    msg.includes('"code":404') ||
    msg.includes("no longer available") ||
    msg.includes("NOT_FOUND")
  ) {
    return new Error(
      `Gemini model ${REASONING_MODEL} is not available to this key. ` +
        "Set the GEMINI_MODEL env var to a currently-available model."
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

const TRANSIENT_MARKERS = [
  "RESOURCE_EXHAUSTED",
  '"code":429',
  '"code":503',
  "UNAVAILABLE",
  "ECONNRESET",
  "ETIMEDOUT",
  "fetch failed",
];

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_MARKERS.some((m) => msg.includes(m));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a Gemini SDK call, retrying on transient errors (quota/rate-limit,
 * 503, network blips) with short backoff before giving up. A non-transient
 * error (bad model name, bad key) fails on the first try — retrying it would
 * just waste the backoff delay on something that will never succeed.
 *
 * Always throws a friendly Error, never the raw SDK/HTTP error — this is the
 * one place that boundary is enforced, so every caller (reasoning calls in
 * callGemini, embedding calls in lib/embeddings.ts) gets it for free.
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  const backoffsMs = [600, 1500];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= backoffsMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < backoffsMs.length && isTransientGeminiError(err)) {
        await sleep(backoffsMs[attempt]);
        continue;
      }
      break;
    }
  }
  throw friendlyGeminiError(lastErr);
}

/**
 * Single-turn call to Gemini that returns the raw text response.
 * The caller runs the result through safeParseJSON.
 */
export async function callGemini({
  prompt,
  maxOutputTokens = 4000,
  temperature = 0.2,
}: CallOptions): Promise<string> {
  const ai = getClient();

  const res = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: REASONING_MODEL,
      contents: prompt,
      config: {
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    })
  );

  const text = res.text;
  if (!text) {
    throw new Error(
      `Gemini returned no text (finishReason: ${
        res.candidates?.[0]?.finishReason ?? "unknown"
      }).`
    );
  }
  return text;
}

// Gemini client + callGemini helper. SERVER-SIDE ONLY.
//
// The API key is read from process.env.GEMINI_API_KEY, which is set as a Vercel
// Environment Variable in production and (optionally) in .env.local for local
// dev. It is never exposed to the browser and never prefixed with NEXT_PUBLIC_.

import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const REASONING_MODEL = "gemini-3.6-flash";
export const EMBEDDING_MODEL = "gemini-embedding-001";
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
  /**
   * SPEC (written for Claude) said 2000 / 4000. gemini-3.6-flash is a
   * thinking-first model and spends part of the output budget on reasoning
   * tokens, so the visible-JSON budgets are raised to avoid truncation:
   * 4000 for most routes, 8000 for the draft. thinkingLevel is held to LOW.
   */
  maxOutputTokens?: number;
  /** SPEC: temperature 0.2. */
  temperature?: number;
};

/**
 * Single-turn call to Gemini that returns the raw text response.
 * temperature 0.2 and thinkingLevel LOW keep the output close to
 * deterministic. The caller runs the result through safeParseJSON.
 */
export async function callGemini({
  prompt,
  maxOutputTokens = 4000,
  temperature = 0.2,
}: CallOptions): Promise<string> {
  const ai = getClient();

  const res = await ai.models.generateContent({
    model: REASONING_MODEL,
    contents: prompt,
    config: {
      temperature,
      maxOutputTokens,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

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

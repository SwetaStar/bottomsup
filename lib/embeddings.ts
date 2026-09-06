// Embedding helpers. SERVER-SIDE ONLY (uses the Gemini key).
// The corpus embedding cache and retrieval live in Phase 3 (/api/retrieve).

import { getClient, EMBEDDING_MODEL, EMBEDDING_DIMS } from "@/lib/gemini";

/**
 * Cosine similarity between two equal-length vectors.
 * Exact and instant for 12 documents — no vector database needed.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Embed a batch of texts in one request. Returns one vector per input. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getClient();
  const res = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: {
      taskType: "SEMANTIC_SIMILARITY",
      outputDimensionality: EMBEDDING_DIMS,
    },
  });
  const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: sent ${texts.length}, got ${vectors.length}.`
    );
  }
  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIMS) {
      throw new Error(
        `Embedding has ${v.length} dims, expected ${EMBEDDING_DIMS}.`
      );
    }
  }
  return vectors;
}

/** Embed a single query string. */
export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

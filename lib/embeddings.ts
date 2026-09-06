// Embedding helpers. SERVER-SIDE ONLY (uses the Gemini key).

import { promises as fs } from "node:fs";
import path from "node:path";
import { getClient, EMBEDDING_MODEL, EMBEDDING_DIMS } from "@/lib/gemini";
import { records } from "@/lib/data";
import type { Engagement } from "@/lib/types";

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

// ---------------------------------------------------------------------------
// Corpus embedding cache
//
// SPEC's original plan was to generate data/embeddings.json locally and commit
// it. With the key living only in Vercel, we instead embed the 12 records on
// first use and cache them in module memory for the life of the server
// instance. If data/embeddings.json IS present (from the optional
// `npm run embed`), it is loaded instead and no embedding call is made.
// ---------------------------------------------------------------------------

export type CorpusVector = { id: string; vector: number[] };

let corpusCache: CorpusVector[] | null = null;
let corpusPromise: Promise<CorpusVector[]> | null = null;

/**
 * Text embedded per engagement. Must stay in step with scripts/embed.mjs.
 * Scope and win themes carry most of the semantic signal, so they are in full.
 */
export function corpusEmbeddingText(r: Engagement): string {
  return [
    r.company.name,
    r.company.sector,
    r.company.sub_sector,
    r.company.geography,
    r.engagement.title,
    r.engagement.scope,
    r.outcome.results,
    (r.win_themes ?? []).join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

async function loadPrebuilt(): Promise<CorpusVector[] | null> {
  try {
    const file = path.join(process.cwd(), "data", "embeddings.json");
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as CorpusVector[];
    const ids = new Set(parsed.map((e) => e.id));
    const ok =
      Array.isArray(parsed) &&
      parsed.length === records.length &&
      records.every((r) => ids.has(r.id)) &&
      parsed.every(
        (e) => Array.isArray(e.vector) && e.vector.length === EMBEDDING_DIMS
      );
    return ok ? parsed : null;
  } catch {
    return null; // not present — expected on Vercel
  }
}

/** The 12 corpus vectors, from the prebuilt file or embedded live once. */
export async function getCorpusEmbeddings(): Promise<CorpusVector[]> {
  if (corpusCache) return corpusCache;
  if (corpusPromise) return corpusPromise;

  corpusPromise = (async () => {
    const prebuilt = await loadPrebuilt();
    if (prebuilt) {
      corpusCache = prebuilt;
      return prebuilt;
    }
    const vectors = await embedTexts(records.map(corpusEmbeddingText));
    corpusCache = records.map((r, i) => ({ id: r.id, vector: vectors[i] }));
    return corpusCache;
  })();

  try {
    return await corpusPromise;
  } finally {
    corpusPromise = null;
  }
}

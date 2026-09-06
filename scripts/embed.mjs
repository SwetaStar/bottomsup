// scripts/embed.mjs  —  OPTIONAL pre-bake.
//
// The app does NOT need this file to run. /api/retrieve embeds the 12 corpus
// records at runtime on first use and caches them in memory (see lib/embeddings.ts).
//
// Run this only if you want to (a) prove the Gemini key works before deploying,
// or (b) pre-bake data/embeddings.json so the first retrieval call is instant.
// If data/embeddings.json exists, the retrieve route loads it instead of
// embedding live. It is safe to commit or to leave out.
//
//   GEMINI_API_KEY=xxxx node scripts/embed.mjs
//   (or put GEMINI_API_KEY in .env.local and just: npm run embed)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const MODEL = "gemini-embedding-001";
const DIMS = 1536;

try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  // No .env.local — rely on an inline GEMINI_API_KEY=... instead.
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "GEMINI_API_KEY is not set.\n" +
      "Run:  GEMINI_API_KEY=your-key node scripts/embed.mjs\n" +
      "or put it in .env.local and run:  npm run embed"
  );
  process.exit(1);
}

const corpus = JSON.parse(fs.readFileSync(path.join(DATA, "corpus.json"), "utf8"));
const records = corpus.records;

// Scope and win themes carry most of the semantic signal, so include them in full.
function embeddingText(r) {
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

const inputs = records.map(embeddingText);
console.log(`Embedding ${inputs.length} records with ${MODEL}...`);

const ai = new GoogleGenAI({ apiKey });
const res = await ai.models.embedContent({
  model: MODEL,
  contents: inputs,
  config: { taskType: "SEMANTIC_SIMILARITY", outputDimensionality: DIMS },
});

const vectors = (res.embeddings ?? []).map((e) => e.values);
if (vectors.length !== records.length) {
  throw new Error(`Expected ${records.length} embeddings, got ${vectors.length}.`);
}

const out = records.map((r, i) => {
  const v = vectors[i];
  if (!Array.isArray(v) || v.length !== DIMS) {
    throw new Error(`${r.id}: expected ${DIMS} dims, got ${v?.length}.`);
  }
  return { id: r.id, vector: v };
});

fs.writeFileSync(
  path.join(DATA, "embeddings.json"),
  JSON.stringify(out, null, 2) + "\n"
);
console.log(
  `Wrote data/embeddings.json — ${out.length} vectors, ${out[0].vector.length} dims each.`
);

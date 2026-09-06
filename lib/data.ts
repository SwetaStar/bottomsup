// Static data, bundled at build time so it is available at runtime on Vercel
// with no filesystem access. corpus.json is used as provided and never modified.

import corpusJson from "@/data/corpus.json";
import criteriaJson from "@/data/criteria.json";
import type { Corpus, Criteria, Engagement } from "@/lib/types";

export const corpus = corpusJson as Corpus;
export const criteria = criteriaJson as Criteria;
export const records: Engagement[] = corpus.records;

export function recordsForClient(clientId: string): Engagement[] {
  return records.filter((r) => r.client_id === clientId);
}

export function recordById(id: string): Engagement | undefined {
  return records.find((r) => r.id === id);
}

/** Distinct client ids, for the UI client selector. */
export const clientIds: string[] = Array.from(
  new Set(records.map((r) => r.client_id))
).sort();

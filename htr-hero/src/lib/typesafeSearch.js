// Fan-out search across the 4 article shards via the TypeSafe System One API.
// Flow per query: 1 state (user query) → 4 parallel calls, each one Choice +
// one Noul question for its shard → mergeShardResults() ranks the finalists
// into a single suggestion list.
//
// All traffic goes same-origin to /api/systemone so the browser never holds
// the API key and never hits a CORS block:
// - `npm run dev` → Vite dev-server proxy (key injected from .env.local)
// - Vercel → serverless function in /api (key from project env vars)

import shard1 from "../data/shards/shard-1.json";
import shard2 from "../data/shards/shard-2.json";
import shard3 from "../data/shards/shard-3.json";
import shard4 from "../data/shards/shard-4.json";
import { buildQuestions, mergeShardResults } from "./rank";

export const SHARDS = [shard1, shard2, shard3, shard4];

const ENDPOINT = "/api/systemone";

export function aiModel() {
  return import.meta.env?.VITE_TYPESAFE_MODEL || "jev-latest";
}

async function queryShard(query, shardIndex, signal) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      state: query,
      model: aiModel(),
      questions: buildQuestions(SHARDS[shardIndex]),
    }),
  });
  if (!res.ok) throw new Error(`shard ${shardIndex + 1}: HTTP ${res.status}`);
  const data = await res.json();
  const rec = data.answers?.recommended_article ?? {};
  return {
    shardIndex,
    choice: rec.choice ?? null,
    probabilities: rec.probabilities ?? {},
    confidence: rec.confidence ?? 0,
    noul: data.answers?.is_relevant_match_found?.noul ?? 0,
  };
}

// Returns { suggestions, maxNoul, verdict, shards }.
// suggestions are article records augmented with _probability/_confidence/_noul/_shard.
// Throws if every shard call fails (caller should fall back to offline search).
export async function searchWithAI(query, { limit = 8, signal } = {}) {
  const settled = await Promise.all(
    SHARDS.map((_, i) =>
      queryShard(query, i, signal).catch((err) => ({
        shardIndex: i,
        error: String((err && err.message) || err),
      }))
    )
  );
  if (settled.every((s) => s.error)) {
    throw new Error(settled[0].error || "TypeSafe request failed");
  }
  return { ...mergeShardResults(settled, SHARDS, limit), shards: settled };
}

// Pure helpers for the 4-shard fan-out search.
// No imports, no env access — runs in browser or Node (unit-testable).

export const NONE = "none_relevant";
export const FOUND = 0.7;
export const ABSENT = 0.35;

// Build the TypeSafe questions payload for one shard.
// Mirrors HTR-questions-shard-N.json.
export function buildQuestions(shard) {
  const criteria = {
    [NONE]: "None of the listed articles address the user's query.",
  };
  for (const a of shard) criteria[a.id] = a.title;
  return {
    recommended_article: {
      type: "choice",
      instructions:
        "Which article best answers or directly relates to the user query?",
      criteria,
    },
    is_relevant_match_found: {
      type: "noul",
      instructions:
        "Does the database contain an article that directly addresses the user inquiry?",
    },
  };
}

export function verdict(exists) {
  if (exists >= FOUND) return "match found";
  if (exists < ABSENT) return "no relevant article";
  return "partial match";
}

// Merge one answer-set per shard into a single ranked suggestion list.
// shardAnswers: [{ shardIndex, choice, probabilities, confidence, noul, error? }]
// lookup: Map articleId -> article record
export function mergeShardResults(shardAnswers, lookup, limit = 8) {
  const candidates = [];

  for (const s of shardAnswers) {
    if (!s || s.error) continue;
    const ranked = Object.entries(s.probabilities || {})
      .filter(([id]) => id !== NONE && lookup.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // top-3 per shard → up to 12 finalists

    for (const [id, p] of ranked) {
      candidates.push({
        article: lookup.get(id),
        probability: p,
        confidence: s.confidence ?? 0,
        noul: s.noul ?? 0,
        shardIndex: s.shardIndex,
      });
    }
  }

  // Rank finalists: within-shard probability, down-weighted when that
  // shard's Noul says it holds no real answer.
  candidates.sort(
    (a, b) =>
      b.probability * (0.5 + 0.5 * b.noul) -
      a.probability * (0.5 + 0.5 * a.noul)
  );

  const seen = new Set();
  const suggestions = [];
  for (const c of candidates) {
    if (seen.has(c.article.id)) continue;
    seen.add(c.article.id);
    suggestions.push({
      ...c.article,
      _probability: c.probability,
      _confidence: c.confidence,
      _noul: c.noul,
      _shard: c.shardIndex,
    });
    if (suggestions.length >= limit) break;
  }

  const ok = shardAnswers.filter((s) => s && !s.error);
  const maxNoul = ok.length ? Math.max(...ok.map((s) => s.noul ?? 0)) : 0;

  return { suggestions, maxNoul, verdict: verdict(maxNoul) };
}

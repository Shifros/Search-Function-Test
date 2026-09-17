// Pure helpers for the 4-shard fan-out search.
// No imports, no env access — runs in browser or Node (unit-testable).

export const NONE = "none_relevant";
export const FOUND = 0.7;
export const ABSENT = 0.35;

// Build the TypeSafe questions payload for one shard.
// Criteria keys are short sequential numbers ("001".."220") instead of long
// IDs — same meaning for the model, far fewer input tokens.
// Mirrors HTR-questions-shard-N.json.
export function buildQuestions(shard) {
  const width = String(shard.length).length;
  const criteria = {
    [NONE]: "None of the listed articles address the user's query.",
  };
  shard.forEach((a, i) => {
    criteria[String(i + 1).padStart(width, "0")] = a.title;
  });
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

// Resolve a Choice answer key ("003", or "none_relevant") back to the article.
export function resolveChoice(shards, shardIndex, key) {
  if (!key || key === NONE) return null;
  const n = parseInt(key, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return shards[shardIndex]?.[n - 1] ?? null;
}

export function verdict(exists) {
  if (exists >= FOUND) return "match found";
  if (exists < ABSENT) return "no relevant article";
  return "partial match";
}

// A shard that explicitly abstains contributes zero candidates — without
// this, Choice's must-pick-something probabilities leak filler from shards
// that hold nothing relevant. MIN_PROB is a second net for winners so weak
// they are noise (uniform noise over ~220 options is ~0.005). TOP_PER_SHARD
// finalists per participating shard keeps recall broad: near-misses from a
// shard that *did* find something are "similar", not filler.
const MIN_PROB = 0.02;
const TOP_PER_SHARD = 5;

// Merge one answer-set per shard into a single ranked suggestion list.
// shardAnswers: [{ shardIndex, choice, probabilities, confidence, noul, error? }]
// shards: the 4 article arrays (choice keys are per-shard numbers → resolveChoice).
export function mergeShardResults(shardAnswers, shards, limit = 8) {
  const candidates = [];

  for (const s of shardAnswers) {
    if (!s || s.error) continue;
    if (s.choice === NONE) continue;
    const ranked = Object.entries(s.probabilities || {})
      .map(([key, p]) => ({ article: resolveChoice(shards, s.shardIndex, key), p }))
      .filter((e) => e.article && e.p >= MIN_PROB)
      .sort((a, b) => b.p - a.p)
      .slice(0, TOP_PER_SHARD); // finalists per participating shard (≤20 → top 8 shown)

    for (const e of ranked) {
      candidates.push({
        article: e.article,
        probability: e.p,
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

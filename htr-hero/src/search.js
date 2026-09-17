// Frontend-only search over the local article index. No backend calls.
export const TRENDING = [
  "How to register a business name",
  "ABN vs ACN",
  ".com.au domain",
  "Trademark a logo",
  "GST registration",
];

function normalize(s) {
  return (s || "").toLowerCase();
}

function tokenize(q) {
  return normalize(q).split(/[^a-z0-9.]+/).filter(Boolean);
}

export function searchArticles(query, articles, limit = 8) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const scored = [];

  for (const a of articles) {
    const title = normalize(a.title);
    const cat = normalize(a.categoryTitle + " " + a.categorySlug);
    const excerpt = normalize(a.excerpt);
    const kw = normalize((a.keywords || []).join(" "));
    let score = 0;
    let matchedAll = true;

    for (const t of tokens) {
      const inTitle = title.includes(t);
      const inCat = cat.includes(t);
      const inKw = kw.includes(t);
      const inExcerpt = excerpt.includes(t);
      if (!inTitle && !inCat && !inKw && !inExcerpt) {
        matchedAll = false;
        break;
      }
      if (inTitle) score += title.startsWith(t) ? 12 : 8;
      if (inCat) score += 4;
      if (inKw) score += 3;
      if (inExcerpt) score += 1;
    }
    if (!matchedAll) continue;

    // Bonus: exact phrase in title
    if (title.includes(normalize(query).trim())) score += 6;
    // Bonus: shorter titles rank slightly higher on ties
    score += Math.max(0, 6 - a.title.length / 60);

    scored.push({ article: a, score });
  }

  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map((s) => s.article);
}

export function countMatches(query, articles) {
  return searchArticles(query, articles, articles.length).length;
}

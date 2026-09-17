import { useEffect, useRef, useState } from "react";
import shard1 from "./data/shards/shard-1.json";
import shard2 from "./data/shards/shard-2.json";
import shard3 from "./data/shards/shard-3.json";
import shard4 from "./data/shards/shard-4.json";
import { searchArticles, TRENDING } from "./search";
import { isAIConfigured, searchWithAI } from "./lib/typesafeSearch";
import "./App.css";

const articles = [...shard1, ...shard2, ...shard3, ...shard4];

const NAV = ["Business", "Domain", "Email & IT", "Logo", "Website", "More"];

function Logo() {
  return (
    <a className="brand" href="#" aria-label="How To Register home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="30" height="30">
          <rect x="3" y="5" width="22" height="22" rx="3" fill="none" stroke="#1f9ede" strokeWidth="2.6" />
          <path d="M8 14.5l5.2 5.2L21.5 11" fill="none" stroke="#1f9ede" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 3l9 4-2.2 1.2L16.5 4.6 18 3z" fill="#b04cc4" />
          <path d="M22.5 8.5l4.5 2-1.2 2.2-4.5-2 1.2-2.2z" fill="#1f6feb" />
        </svg>
      </span>
      <span className="brand-text">
        <strong>HOW TO</strong>
        <strong>REGISTER</strong>
      </span>
    </a>
  );
}

function highlight(title, query) {
  const q = query.trim();
  if (q.length < 2) return title;
  const idx = title.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return title;
  return (
    <>
      {title.slice(0, idx)}
      <mark>{title.slice(idx, idx + q.length)}</mark>
      {title.slice(idx + q.length)}
    </>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const [results, setResults] = useState([]);
  const [ai, setAi] = useState({ mode: isAIConfigured() ? "ai" : "local", verdict: null });
  const reqId = useRef(0);

  useEffect(() => {
    setActive(0);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    // No API key yet → instant offline search over the local index.
    if (!isAIConfigured()) {
      setResults(searchArticles(query, articles, 8));
      setAi({ mode: "local", verdict: null });
      return;
    }
    // API key present → fan out to Jev across the 4 shards (debounced).
    const id = ++reqId.current;
    setAi((s) => ({ ...s, mode: "ai-loading" }));
    const t = setTimeout(async () => {
      try {
        const r = await searchWithAI(query, { limit: 8 });
        if (reqId.current !== id) return;
        setResults(r.suggestions);
        setAi({ mode: "ai", verdict: r.verdict });
      } catch {
        if (reqId.current !== id) return;
        // Any API failure → fall back to offline search, never a dead box.
        setResults(searchArticles(query, articles, 8));
        setAi({ mode: "local-fallback", verdict: null });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showPanel = open && query.trim().length >= 2;

  function choose(a) {
    setSelected(a);
    setOpen(false);
    setShowAbout(false);
  }

  function onKey(e) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (results.length) choose(results[active] || results[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <nav className="nav" aria-label="Primary">
            <a href="#" className="nav-link is-active">Home</a>
            {NAV.map((n) => (
              <a key={n} href="#" className="nav-link" onClick={(e) => e.preventDefault()}>
                {n}
                <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
                  <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </a>
            ))}
          </nav>
          <div className="actions">
            <button type="button" className="btn btn-ghost">Get help</button>
            <button type="button" className="btn btn-primary">Do it for me</button>
          </div>
        </div>
      </header>

      <main className="hero">
        <h1 className="headline">
          All the business setup
          <br />
          topics - <span className="grad">in one place!</span>
        </h1>

        <div className="search-wrap" ref={boxRef}>
          <div className="searchbar">
            <svg viewBox="0 0 24 24" width="21" height="21" className="search-ico" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="#9aa1ad" strokeWidth="2" />
              <path d="M16.5 16.5L21 21" stroke="#9aa1ad" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setSelected(null); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
              placeholder="Search for topics about business, domain, logo, website..."
              aria-label="Search help articles"
              role="combobox"
              aria-expanded={showPanel}
              aria-controls="search-results"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="clear"
                aria-label="Clear search"
                onClick={() => { setQuery(""); setSelected(null); inputRef.current?.focus(); }}
              >
                ×
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-search"
              onClick={() => { setOpen(true); if (results.length) choose(results[active] || results[0]); }}
            >
              Search
            </button>
          </div>

          {showPanel && (
            <div className="panel" id="search-results" role="listbox" aria-label="Matching articles">
              <div className="panel-head">
                <span className={"mode-badge mode-" + ai.mode}>
                  {ai.mode === "ai"
                    ? `✦ AI ranked · ${ai.verdict}`
                    : ai.mode === "ai-loading"
                      ? "… asking Jev"
                      : ai.mode === "local-fallback"
                        ? "AI unreachable · offline results"
                        : "Offline index"}
                </span>
                {results.length > 0 ? (
                  <span><strong>{results.length}</strong> result{results.length === 1 ? "" : "s"} for “{query.trim()}” · {articles.length} articles indexed</span>
                ) : (
                  <span>No matches for “{query.trim()}” · try “ABN”, “domain” or “trademark”</span>
                )}
              </div>
              {results.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={"hit" + (i === active ? " is-active" : "")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(a)}
                >
                  <span className="hit-cat">{a.categoryTitle}</span>
                  <span className="hit-body">
                    <span className="hit-title">{highlight(a.title, query)}</span>
                    {a.excerpt && <span className="hit-ex">{a.excerpt}…</span>}
                  </span>
                  <span className="hit-go" aria-hidden="true">→</span>
                </button>
              ))}
              {results.length === 0 && (
                <div className="empty">
                  <p><strong>Nothing found.</strong> The demo index holds {articles.length} articles and runs fully in the browser.</p>
                  <div className="empty-tags">
                    {TRENDING.map((t) => (
                      <button key={t} type="button" onClick={() => { setQuery(t); setOpen(true); }}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="quick">
          <button type="button" className="pill" onClick={() => { setQuery("ABN registration"); setOpen(true); setSelected(null); inputRef.current?.focus(); }}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 12l3.5-6 2.5 3.5L11 5l3 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Trending searches
          </button>
          <button type="button" className="pill" onClick={() => { setShowAbout((v) => !v); setSelected(null); }}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M6.2 6.2c.2-1 1-1.6 1.9-1.6 1 0 1.9.7 1.9 1.7 0 1.2-1.3 1.4-1.8 2.2-.1.2-.1.4-.1.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="8" cy="11.4" r=".9" fill="currentColor" /></svg>
            What is How To Register?
          </button>
        </div>

        {selected && (
          <article className="preview" aria-live="polite">
            <span className="hit-cat">{selected.categoryTitle}</span>
            <h2>{selected.title}</h2>
            {selected.excerpt && <p>{selected.excerpt}…</p>}
            <div className="preview-meta">
              <code>/{selected.categorySlug}/{selected.slug}</code>
              <span className="demo-note">Frontend demo — article page not wired yet (no backend).</span>
            </div>
          </article>
        )}

        {showAbout && !selected && (
          <article className="preview" aria-live="polite">
            <span className="hit-cat">About</span>
            <h2>What is How To Register?</h2>
            <p>A guided library for every stage of business setup — business, domain, email &amp; IT, logo, website and more. Use the search above to find answers across {articles.length} articles. Backend search is not wired yet; everything runs locally in your browser.</p>
          </article>
        )}

        <button
          type="button"
          className="scroll-cue"
          aria-label="Scroll to topics"
          onClick={() => document.getElementById("stats")?.scrollIntoView({ behavior: "smooth" })}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 9.5l6 6 6-6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <section className="stats" id="stats">
          <p className="stats-line">
            <span className="blue">10 Topics</span><span className="sep">, </span>
            <span className="blue">100 Sub-topics</span>
            <span className="dim"> and </span>
            <span className="blue">825 Questions</span>
          </p>
          <p className="stats-sub">Topics and information for every stage of business setup. Pick a category below or search above.</p>
          <p className="index-note">{articles.length} articles loaded in this frontend demo · search runs 100% locally</p>
        </section>
      </main>

      <button type="button" className="corner left" aria-label="Cookie settings">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 3a9 9 0 100 18 2.4 2.4 0 002.3-1.7 2.3 2.3 0 011.8-1.5 2.4 2.4 0 001.7-2.3A9 9 0 0012 3z" fill="none" stroke="#a16207" strokeWidth="1.8" />
          <circle cx="9.5" cy="10" r="1.1" fill="#a16207" /><circle cx="13.5" cy="14.5" r="1.1" fill="#a16207" /><circle cx="10" cy="15.5" r=".9" fill="#a16207" /><circle cx="14.5" cy="10" r=".9" fill="#a16207" />
        </svg>
      </button>
      <button type="button" className="corner right" aria-label="Chat with us">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M4 6.5A3.5 3.5 0 017.5 3h9A3.5 3.5 0 0120 6.5v6a3.5 3.5 0 01-3.5 3.5H12l-4.2 3.4c-.5.4-1.3 0-1.3-.6V16a3.5 3.5 0 01-2.5-3.3v-6.2z" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

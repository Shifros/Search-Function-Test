// Vercel serverless function: same-origin proxy for the TypeSafe System One API.
//
// Why: browsers can't call api.typesafe.ai directly (CORS block) and the key
// must never ship to client JavaScript. The frontend POSTs here; this function
// attaches TYPESAFE_API_KEY server-side and forwards to TypeSafe.
//
// Setup: Vercel → Project → Settings → Environment Variables → add
// TYPESAFE_API_KEY (all environments), then redeploy.
const UPSTREAM = "https://api.typesafe.ai/v1/systemone";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed, use POST" });
  }

  const key = process.env.TYPESAFE_API_KEY || process.env.VITE_TYPESAFE_API_KEY;
  if (!key) {
    return res
      .status(500)
      .json({ error: "Server misconfigured: TYPESAFE_API_KEY is not set" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }
  if (!body || typeof body !== "object" || !body.questions) {
    return res
      .status(400)
      .json({ error: "Body must include state, model and questions" });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: body.state,
        model: body.model || "jev-latest",
        questions: body.questions,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await upstream.json().catch(() => null);
    return res.status(upstream.status).json(data ?? { error: "Upstream error" });
  } catch (err) {
    return res
      .status(502)
      .json({ error: `Upstream unreachable: ${(err && err.message) || err}` });
  }
}

// Vercel serverless function: proxies AI calls so the Anthropic key never reaches the browser.
// Only signed-in Loop users (valid Supabase token) can call it.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, AI_MODEL } = process.env;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "AI not configured" });

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const u = token && await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!u || !u.ok) return res.status(401).json({ error: "Sign in required" });
  }

  const { system, messages, max_tokens } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "messages required" });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: AI_MODEL || "claude-sonnet-5-5", max_tokens: Math.min(+max_tokens || 1000, 2000), system, messages }),
  });
  res.status(r.status).setHeader("content-type", "application/json").send(await r.text());
}

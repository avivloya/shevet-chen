/*
  Cheny helper for the Shevet Chen website (a Cloudflare Worker).

  It keeps the Anthropic API key secret. The website sends Cheny's
  conversation here with the person's Firebase sign-in token. The helper
  checks that the person is approved (or is the owner), then asks Claude
  and streams the answer back.

  Settings (Cloudflare > Workers > this worker > Settings > Variables):
    ANTHROPIC_API_KEY  (Secret)  your key from console.anthropic.com
    MODEL              (Text)    optional, default claude-opus-5-5
                                 (claude-haiku-5-5 is much cheaper)
*/

const FIREBASE_API_KEY = "AIzaSyC_jqZL8B-y2hiGXXCWJfMsKLTPpAas4To";
const PROJECT = "shevet-chen";
const ALLOWED_ORIGINS = ["https://avivloya.github.io"];
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const MAX_BODY = 300000;   // characters
const MAX_TURNS = 30;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Vary": "Origin",
    };
    const fail = (status, msg) =>
      new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return fail(405, "POST only");
    if (!ALLOWED_ORIGINS.includes(origin)) return fail(403, "Not allowed from this site");
    if (!env.ANTHROPIC_API_KEY) return fail(500, "The AI key is not set up yet");

    // 1. Who is asking? Check the Firebase sign-in token.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(401, "Please sign in");
    const look = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
    });
    if (!look.ok) return fail(401, "Please sign in again");
    const uid = ((await look.json()).users || [])[0]?.localId;
    if (!uid) return fail(401, "Please sign in again");

    // 2. Are they approved for the shachbag (or the owner)?
    const auth = { Authorization: `Bearer ${token}` };
    let allowed = false;
    const ap = await fetch(`${FS}/approvals/${uid}`, { headers: auth });
    if (ap.ok) {
      const f = (await ap.json()).fields || {};
      allowed = f.status?.stringValue === "approved" && f.portal?.stringValue === "shachbag";
    }
    if (!allowed) {
      const ow = await fetch(`${FS}/settings/owner`, { headers: auth });
      if (ow.ok) allowed = ((await ow.json()).fields || {}).uid?.stringValue === uid;
    }
    if (!allowed) return fail(403, "Cheny is only for approved members");

    // 3. Check the conversation.
    const raw = await req.text();
    if (raw.length > MAX_BODY) return fail(413, "That conversation is too long. Start a new one.");
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, "Bad request"); }
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content)
      .slice(-MAX_TURNS);
    if (!messages.length || messages[0].role !== "user") return fail(400, "Bad request");

    // 4. Ask Claude and stream the answer back.
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.MODEL || "claude-opus-5-5",
        max_tokens: 4000,
        output_config: { effort: "low" },
        fallbacks: "default",
        cache_control: { type: "ephemeral" },
        stream: true,
        messages,
      }),
    });
    if (!ai.ok) {
      const detail = await ai.text();
      console.log("Anthropic error", ai.status, detail.slice(0, 500));
      return fail(502, ai.status === 401 ? "The AI key is wrong" : ai.status === 429 ? "Cheny is busy. Try again in a minute." : "Cheny had a problem. Try again.");
    }
    return new Response(ai.body, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  },
};

/*
  Helper for the Shevet Chen website (one Cloudflare Worker).

  It does two jobs:
  1. Cheny: keeps the Anthropic API key secret. The website sends Cheny's
     conversation here with the person's Firebase sign-in token. The helper
     checks that the person is approved (or is the owner), then asks Claude
     and streams the answer back.            (POST /)
  2. Notifications: keeps the list of phones that turned notifications on,
     and sends a notification when someone posts an announcement, a group
     chat message, an event, a to-do or a machsan request.   (/push/...)

  Settings (Cloudflare > Workers > this worker > Settings):
    Variables:
      ANTHROPIC_API_KEY  (Secret)  your key from console.anthropic.com (only for Cheny)
      MODEL              (Text)    optional, default claude-opus-5-5
                                   (claude-haiku-5-5 is much cheaper)
    Bindings:
      PUSH               (KV namespace)  needed for notifications
*/

const FIREBASE_API_KEY = "AIzaSyC_jqZL8B-y2hiGXXCWJfMsKLTPpAas4To";
const PROJECT = "shevet-chen";
const ALLOWED_ORIGINS = ["https://avivloya.github.io"];
const SITE = "https://avivloya.github.io/shevet-chen/";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const MAX_BODY = 300000;   // characters
const MAX_TURNS = 30;
const TIER1 = ["mifalim", "tzeirim", "bogeret", "boger"];
const TYPES = ["announce", "chat", "event", "task", "machsan"];

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Vary": "Origin",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
    const fail = (status, msg) => json({ error: msg }, status);

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";

    if (path === "/push/key") {
      if (!env.PUSH) return fail(500, "Notifications are not set up yet");
      return json({ key: (await vapidKeys(env)).pub });
    }

    if (req.method !== "POST") return fail(405, "POST only");
    if (!ALLOWED_ORIGINS.includes(origin)) return fail(403, "Not allowed from this site");

    // Who is asking? Check the Firebase sign-in token.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(401, "Please sign in");
    const look = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
    });
    if (!look.ok) return fail(401, "Please sign in again");
    const uid = ((await look.json()).users || [])[0]?.localId;
    if (!uid) return fail(401, "Please sign in again");
    const me = await member(uid, token);
    if (!me.approved && !me.owner) return fail(403, "Only for approved members");

    if (path.startsWith("/push/")) {
      if (!env.PUSH) return fail(500, "Notifications are not set up yet");
      let body = {};
      try { body = JSON.parse((await req.text()).slice(0, 20000) || "{}"); } catch { return fail(400, "Bad request"); }
      if (path === "/push/subscribe") return json(await pushSubscribe(env, me, body));
      if (path === "/push/notify") return json(await pushNotify(env, me, token, body));
      if (path === "/push/status") {
        if (!me.owner && !me.tier1) return fail(403, "Only for merakzim");
        return json(await pushStatus(env));
      }
      return fail(404, "Not found");
    }

    if (path !== "/") return fail(404, "Not found");
    if (!env.ANTHROPIC_API_KEY) return fail(500, "The AI key is not set up yet");

    // Check the conversation.
    const raw = await req.text();
    if (raw.length > MAX_BODY) return fail(413, "That conversation is too long. Start a new one.");
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, "Bad request"); }
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content)
      .slice(-MAX_TURNS);
    if (!messages.length || messages[0].role !== "user") return fail(400, "Bad request");

    // Ask Claude and stream the answer back.
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

/* ---------- who is this person in the shevet ---------- */
const norm = u => String(u || "").trim().toLowerCase();
const PEILIM = [["Machsan Kiosk", "מחסן וקיוסק"], ["Adrachat Shachbag", "הדרכת שכב״ג"], ["Omanut", "אומנות"], ["Ivrit", "עברית"], ["Tzofiut", "צופיות"]];
function gkOf(role, unit) {
  if (TIER1.includes(role)) return "merakzim";
  if (role === "rashatz" || role === "peil") {
    const u = norm(String(unit || "").replace(/^(peilim|פעילים)\s+/i, ""));
    const p = PEILIM.find(x => norm(x[0]) === u || norm(x[1]) === u);
    return "group:" + (p ? norm(p[0]) : u);
  }
  if (role === "rashgad" || role === "madrich") return "grade:" + norm(unit);
  return role ? "role:" + role : "";
}
const sv = (f, k) => f?.[k]?.stringValue ?? "";
async function member(uid, token) {
  const auth = { Authorization: `Bearer ${token}` };
  const out = { uid, approved: false, owner: false, role: "", unit: "", gk: "", tier1: false };
  const ap = await fetch(`${FS}/approvals/${uid}`, { headers: auth });
  if (ap.ok) {
    const f = (await ap.json()).fields || {};
    out.approved = sv(f, "status") === "approved" && sv(f, "portal") === "shachbag";
    if (out.approved) { out.role = sv(f, "role"); out.unit = sv(f, "unit"); }
  }
  const ow = await fetch(`${FS}/settings/owner`, { headers: auth });
  if (ow.ok) out.owner = sv((await ow.json()).fields, "uid") === uid;
  out.tier1 = TIER1.includes(out.role);
  out.gk = gkOf(out.role, out.unit);
  return out;
}

/* ---------- notifications ---------- */
async function pushSubscribe(env, me, body) {
  const key = "sub:" + me.uid;
  const rec = (await env.PUSH.get(key, "json")) || { subs: [] };
  const sub = body.sub;
  if (sub && typeof sub.endpoint === "string" && /^https:\/\//.test(sub.endpoint) && sub.keys?.p256dh && sub.keys?.auth) {
    rec.subs = (rec.subs || []).filter(s => s.endpoint !== sub.endpoint);
    rec.subs.push({ endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } });
    rec.subs = rec.subs.slice(-5);   // up to 5 devices
  }
  if (body.drop) rec.subs = (rec.subs || []).filter(s => s.endpoint !== body.drop);
  const prefs = {};
  TYPES.forEach(t => { prefs[t] = !(body.prefs && body.prefs[t] === false); });
  Object.assign(rec, {
    uid: me.uid, role: me.role, gk: me.gk, tier1: me.tier1, owner: me.owner,
    perm: ["granted", "denied", "default", "unsupported"].includes(body.perm) ? body.perm : "unknown",
    prefs, lang: body.lang === "he" ? "he" : "en", at: Date.now(),
  });
  await env.PUSH.put(key, JSON.stringify(rec));
  return { ok: true, on: rec.perm === "granted" && rec.subs.length > 0 };
}

async function pushStatus(env) {
  const people = [];
  let cursor;
  do {
    const page = await env.PUSH.list({ prefix: "sub:", cursor });
    for (const k of page.keys) {
      const r = await env.PUSH.get(k.name, "json");
      if (r) people.push({ uid: r.uid, perm: r.perm, devices: (r.subs || []).length, prefs: r.prefs, at: r.at });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return { people };
}

const TXT = {
  announce: { en: "Chen Announcements", he: "הודעות חן" },
  chat: { en: "{g} chat", he: "צ׳אט {g}" },
  event: { en: "New event", he: "אירוע חדש" },
  task: { en: "New to-do", he: "משימה חדשה" },
  machsan: { en: "New machsan request", he: "בקשה חדשה מהמחסן" },
  items: { en: "Items were requested", he: "התבקש ציוד" },
};
function fsVal(v) {
  if (!v) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsVal);
  return undefined;
}
async function pushNotify(env, me, token, body) {
  const m = /^(broadcasts|events|tasks|machsanReq)\/([A-Za-z0-9_-]{1,64})$/.exec(String(body.path || ""));
  if (!m) return { sent: 0 };
  // Read the new item as the person who made it (so nobody can notify about things they can't see).
  const r = await fetch(`${FS}/${m[1]}/${m[2]}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return { sent: 0 };
  const f = (await r.json()).fields || {};
  const d = {};
  Object.keys(f).forEach(k => { d[k] = fsVal(f[k]); });
  if (!d.createdAt || Date.now() - d.createdAt > 5 * 60 * 1000) return { sent: 0 };   // only brand-new items
  const once = `sent:${m[1]}/${m[2]}`;
  if (await env.PUSH.get(once)) return { sent: 0 };
  await env.PUSH.put(once, "1", { expirationTtl: 86400 });

  let type, title, text, sees, url = SITE;
  const roles = Array.isArray(d.seeRoles) ? d.seeRoles : [];
  const byRoles = s => s.owner || !roles.length || roles.includes(s.role);
  if (m[1] === "broadcasts" && d.gk) {
    type = "chat"; const g = d.unit || d.groupRole || "";
    title = l => TXT.chat[l].replace("{g}", g).trim(); text = d.text; sees = s => s.owner || s.tier1 || s.gk === d.gk; url = SITE + "#group";
  } else if (m[1] === "broadcasts") {
    type = "announce"; title = l => TXT.announce[l]; text = d.text; sees = byRoles; url = SITE + "#messages";
  } else if (m[1] === "events") {
    type = "event"; title = l => TXT.event[l];
    text = [d.title, [d.date, d.time].filter(Boolean).join(" "), d.place].filter(Boolean).join(" · "); sees = byRoles; url = SITE + "#calendar";
  } else if (m[1] === "tasks") {
    type = "task"; const gk = gkOf(d.role, d.unit);
    title = l => TXT.task[l]; text = d.text; sees = s => s.gk === gk || (gk === "merakzim" && s.owner); url = SITE + "#group";
  } else {
    type = "machsan"; const gk = gkOf("rashatz", "Machsan Kiosk");
    title = l => TXT.machsan[l]; text = d.forLabel || d.itemName || null; sees = s => s.gk === gk;
  }
  const sender = me.uid;
  let sent = 0, cursor;
  const jobs = [];
  do {
    const page = await env.PUSH.list({ prefix: "sub:", cursor });
    for (const k of page.keys) {
      const s = await env.PUSH.get(k.name, "json");
      if (!s || s.uid === sender || s.perm !== "granted" || !(s.subs || []).length) continue;
      if (s.prefs && s.prefs[type] === false) continue;
      if (!sees(s)) continue;
      const msg = JSON.stringify({ title: title(s.lang), body: String(text || TXT.items[s.lang]).slice(0, 180), url, tag: type });
      for (const sub of s.subs) jobs.push(sendPush(env, sub, msg).then(st => {
        if (st === 404 || st === 410) return dropSub(env, s.uid, sub.endpoint);
        if (st >= 200 && st < 300) sent++;
      }).catch(() => {}));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  await Promise.all(jobs);
  return { sent };
}
async function dropSub(env, uid, endpoint) {
  const key = "sub:" + uid, rec = await env.PUSH.get(key, "json");
  if (!rec) return;
  rec.subs = (rec.subs || []).filter(s => s.endpoint !== endpoint);
  await env.PUSH.put(key, JSON.stringify(rec));
}

/* ---------- Web Push (VAPID + aes128gcm), no libraries ---------- */
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; a.forEach(x => { o.set(x, i); i += x.length; }); return o; };

async function vapidKeys(env) {
  let k = await env.PUSH.get("vapid", "json");
  if (!k) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
    k = { jwk, pub: b64u(raw) };
    await env.PUSH.put("vapid", JSON.stringify(k));
  }
  return k;
}
async function vapidHeader(env, endpoint) {
  const k = await vapidKeys(env);
  const key = await crypto.subtle.importKey("jwk", k.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:shevet-chen-app@users.noreply.github.com" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + claims));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${k.pub}`;
}
async function hkdf(salt, ikm, info, bits) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bits));
}
export async function encryptPush(sub, text) {
  const uaPub = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(enc.encode("WebPush: info\0"), uaPub, asPub), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 96);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, cat(enc.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPub.length;
  return cat(head, asPub, ct);
}
async function sendPush(env, sub, text) {
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidHeader(env, sub.endpoint), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" },
    body: await encryptPush(sub, text),
  });
  return res.status;
}

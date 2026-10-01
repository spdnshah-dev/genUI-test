#!/usr/bin/env node
/**
 * Learnbay Generative UI – zero-dependency server.
 *
 *  - Serves the Gen UI frontend from ./public
 *  - Serves the mirrored production assets from ../assets (images, logos)
 *  - Exposes POST /api/generate which streams UI components (NDJSON) produced by an LLM
 *
 * Provider selection (env):
 *   LLM_PROVIDER = pollinations (default, free, no key) | groq | openrouter | ollama | openai | custom
 *   LLM_API_KEY  = key for providers that need one
 *   LLM_MODEL    = override model id
 *   LLM_BASE_URL = override chat-completions base URL (custom)
 *   PORT         = http port (default 3000)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, "public");
const LEGACY_ROOT = path.join(__dirname, "..");
const PROGRAM = JSON.parse(fs.readFileSync(path.join(PUBLIC, "data", "program.json"), "utf8"));

const PROVIDERS = {
  pollinations: { url: "https://text.pollinations.ai/openai", model: "openai", key: null },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free" },
  ollama: { url: "http://127.0.0.1:11434/v1/chat/completions", model: "llama3.2" },
  openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  custom: { url: process.env.LLM_BASE_URL || "", model: process.env.LLM_MODEL || "" },
};
const providerName = (process.env.LLM_PROVIDER || "pollinations").toLowerCase();
const provider = { ...(PROVIDERS[providerName] || PROVIDERS.custom) };
provider.model = process.env.LLM_MODEL || provider.model;
provider.key = process.env.LLM_API_KEY || provider.key || null;
if (process.env.LLM_BASE_URL) provider.url = process.env.LLM_BASE_URL;

/* ------------------------------------------------------------------ */
/* Prompt: component catalog + compact knowledge base                   */
/* ------------------------------------------------------------------ */
const CATALOG = `
You are the layout engine of a Generative UI web page for the "${PROGRAM.name}" by ${PROGRAM.brand}.
You do not write HTML. You emit a sequence of UI components, ONE JSON OBJECT PER LINE (NDJSON), nothing else.
Each line: {"type":"<component>","props":{...},"reason":"<=12 words why this block helps this visitor"}
Compose a page tailored to the visitor's intent and persona. Pick only components that serve the intent (4-9 blocks).
Order matters: lead with the most relevant block. Personalize copy (headlines, insights, roadmap) to the visitor.
Use ONLY facts from the knowledge base. Never invent prices, durations, partners or guarantees.

COMPONENT CATALOG (type -> props):
- theme {accent:"#hex", accent2:"#hex", mood:"nebula"|"aurora"|"ember"|"mono"}  (optional, must be first if used)
- hero {eyebrow, headline, highlight:"<substring of headline to gradient>", sub, badges:[string], ctas:[{label, action:"apply"|"demo"|"syllabus"|"ask", ask?:"follow-up question"}]}
- stats {items:[{value,label}]}  (3-6 items, from knowledge base stats/quickFacts)
- insight {title, body, tone:"info"|"success"|"warn", bullets?:[string]}  (personalized advice for THIS visitor)
- pillars {title?, items:[{title,text}]}
- curriculum {title?, mode:"timeline"|"accordion", terms?:[termId], emphasis?:[termId]}  (omit terms for all 13)
- chart {title, kind:"bars", series:[{label,value,unit}]}  (e.g. months per term)
- projects {title?, ids?:[0-5]}
- tools {title?}
- companies {title?}
- certifications {ids?:["ibm","microsoft","project-certificate","gen-ai-certificate"]}
- pricing {months?:3|6|9|12|18, note?}
- comparison {title?}
- roadmap {title, steps:[{when,label,text}]}  (a personalized month-by-month plan)
- eligibility {prefillRole?, prefillExperience?:"Freshers"|"1-3 years"|"3-5 years"|"5-7 years"|"7+ years"}
- faq {title?, ids?:[faqIndex], limit?}  (ids reference FAQ index list below)
- testimonials {}
- mentors {}
- placement {}
- admission {}
- cta {title, text, buttonLabel, action:"apply"|"demo"|"syllabus"|"ask", ask?}
- suggestions {items:[3-5 short follow-up questions the visitor might ask next]}   (ALWAYS the last line)
`;

function knowledgeBase() {
  const p = PROGRAM;
  const terms = p.curriculum.map((t) => `${t.id}: ${t.term} – ${t.title} (${t.duration}) chapters: ${t.chapters.map((c) => c.title).join("; ")}`);
  const faq = p.faq.map((f, i) => `${i}: [${f.section}] ${f.q}`);
  return `
KNOWLEDGE BASE
Program: ${p.name}. ${p.subtitle} ${p.description}
Eligibility: ${p.eligibility.summary}. Roles: ${p.eligibility.roles.join(", ")}. Note: ${p.eligibility.note}
Quick facts: ${Object.entries(p.quickFacts).map(([k, v]) => `${k}=${v}`).join(" | ")}
Stats: ${p.stats.map((s) => `${s.value} ${s.label}`).join(", ")}
Pillars: ${p.pillars.map((x) => x.title).join(" | ")}
Domains: ${p.domains.join(", ")}
Training modes: ${p.trainingModes.map((m) => m.name).join(" / ")}
Projects (ids 0-5): ${p.projects.map((x, i) => `${i}: ${x.title} (${x.company})`).join("; ")}
Tools: ${p.tools.join(", ")}
Alumni companies: ${p.companies.map((c) => c.name).join(", ")}
Certifications: ${p.certifications.map((c) => `${c.id} = ${c.title}`).join("; ")}
Pricing: ${p.pricing.feeDisplay} + ${p.pricing.gstPercent}% GST. ${p.pricing.emi}. ${p.pricing.loan}. ${p.pricing.scholarship}. Group: ${p.pricing.groupDiscount}
Placement: ${p.placement.map((x) => x.title).join(", ")}. Admission: ${p.admission.map((a) => a.step).join(" -> ")}
Curriculum terms:
${terms.join("\n")}
FAQ index:
${faq.join("\n")}
`;
}
const SYSTEM_PROMPT = CATALOG + knowledgeBase();

/* ------------------------------------------------------------------ */
/* LLM streaming (fetch, with curl fallback for proxied sandboxes)      */
/* ------------------------------------------------------------------ */
const DEBUG = Boolean(process.env.DEBUG);
function requestBody(messages, stream) {
  const b = { model: provider.model, messages, stream, temperature: 0.7, max_tokens: 3500 };
  if (providerName === "pollinations" || /gpt-oss|o[134]-/.test(provider.model)) b.reasoning_effort = "low";
  return JSON.stringify(b);
}

async function* streamChat(messages) {
  const body = requestBody(messages, true);
  const headers = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (provider.key) headers.Authorization = `Bearer ${provider.key}`;
  if (providerName === "openrouter") headers["HTTP-Referer"] = "http://localhost:" + PORT;

  let source;
  try {
    const res = await fetch(provider.url, { method: "POST", headers, body });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    source = res.body;
  } catch (err) {
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    if (!proxy || /LLM HTTP/.test(err.message)) throw err;
    // Node's fetch ignores HTTPS_PROXY; fall back to curl which honours it.
    const args = ["-sN", "-X", "POST", provider.url, "-H", "Content-Type: application/json", "-d", body];
    if (provider.key) args.push("-H", `Authorization: Bearer ${provider.key}`);
    const child = spawn("curl", args);
    source = child.stdout;
  }

  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of source) {
    buf += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text ?? "";
        if (delta) yield delta;
      } catch { /* partial / keep-alive */ }
    }
  }
}

/**
 * Turns a token stream into complete JSON component objects as soon as each closes.
 * Scans brace depth (string/escape aware), so it tolerates NDJSON, a JSON array,
 * code fences, prose around the objects, or everything on one line.
 */
async function* componentsFrom(tokenStream, raw = { text: "" }) {
  let depth = 0, inStr = false, escp = false, cur = "";
  const flush = (s) => {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj.type === "string") return obj;
      if (obj && Array.isArray(obj.components)) return obj.components; // wrapped form
    } catch { /* not a component */ }
    return null;
  };
  for await (const tok of tokenStream) {
    raw.text += tok;
    for (const ch of tok) {
      if (depth === 0) {
        if (ch === "{") { depth = 1; cur = "{"; inStr = false; escp = false; }
        continue;
      }
      cur += ch;
      if (inStr) {
        if (escp) escp = false;
        else if (ch === "\\") escp = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const out = flush(cur);
          cur = "";
          if (Array.isArray(out)) { for (const c of out) if (c && typeof c.type === "string") yield c; }
          else if (out) yield out;
        }
      }
    }
  }
}

/** Non-streaming repair call used when the streamed answer produced nothing usable. */
async function repairChat(messages) {
  const body = requestBody(messages.concat({ role: "user", content: 'Your previous answer was not valid NDJSON. Reply with ONLY a JSON object: {"components":[{"type":...,"props":{...},"reason":...}, ...]} ending with a suggestions component.' }), false);
  const headers = { "Content-Type": "application/json" };
  if (provider.key) headers.Authorization = `Bearer ${provider.key}`;
  const res = await fetch(provider.url, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || "";
  const out = [];
  async function* once() { yield text; }
  for await (const c of componentsFrom(once())) out.push(c);
  return out;
}

const cache = new Map(); // key -> components[]
const CACHE_TTL_MS = 30 * 60 * 1000;

function buildMessages({ intent, persona, history }) {
  const ctx = [];
  if (persona) ctx.push(`Visitor persona: ${persona}`);
  if (history?.length) ctx.push(`Earlier questions this session: ${history.slice(-4).join(" | ")}`);
  ctx.push(`Current intent: ${intent}`);
  ctx.push("Respond with NDJSON components only. Start with a theme line that fits the mood of the intent.");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: ctx.join("\n") },
  ];
}

async function handleGenerate(req, res) {
  let payload = "";
  for await (const c of req) payload += c;
  let body;
  try { body = JSON.parse(payload || "{}"); } catch { body = {}; }
  const intent = String(body.intent || "Give me an overview of the program").slice(0, 500);
  const persona = String(body.persona || "").slice(0, 200);
  const history = Array.isArray(body.history) ? body.history.map(String).slice(-6) : [];
  const key = crypto.createHash("sha1").update(JSON.stringify({ intent, persona, m: provider.model })).digest("hex");

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    Connection: "keep-alive",
  });
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  send({ type: "meta", props: { provider: providerName, model: provider.model, cached: cache.has(key) } });

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS && !body.nocache) {
    for (const c of hit.components) { send(c); await new Promise((r) => setTimeout(r, 120)); }
    send({ type: "done", props: { count: hit.components.length, cached: true } });
    return res.end();
  }

  const collected = [];
  const messages = buildMessages({ intent, persona, history });
  const raw = { text: "" };
  const started = Date.now();
  try {
    for await (const comp of componentsFrom(streamChat(messages), raw)) {
      collected.push(comp);
      send(comp);
    }
    if (!collected.length) {
      if (DEBUG) console.error("[debug] empty stream, raw model text:\n" + raw.text.slice(0, 2000));
      send({ type: "meta", props: { provider: providerName, model: provider.model, repairing: true } });
      for (const comp of await repairChat(messages)) { collected.push(comp); send(comp); }
    }
    if (!collected.length) throw new Error("The model returned no components");
    if (!collected.some((c) => c.type === "suggestions")) {
      const s = { type: "suggestions", props: { items: ["What are the fees and EMI options?", "Show me the curriculum", "Which projects will I build?", "Am I eligible?"] }, reason: "default follow-ups" };
      collected.push(s); send(s);
    }
    cache.set(key, { at: Date.now(), components: collected });
    send({ type: "done", props: { count: collected.length, ms: Date.now() - started } });
    console.log(`[generate] ${collected.length} components in ${Date.now() - started}ms · "${intent.slice(0, 60)}"`);
  } catch (err) {
    console.error(`[generate] failed: ${err.message}`);
    send({ type: "error", props: { message: err.message || String(err) } });
  }
  res.end();
}

/* ------------------------------------------------------------------ */
/* Static files                                                         */
/* ------------------------------------------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".mp4": "video/mp4",
};
function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "public, max-age=3600" });
    fs.createReadStream(file).pipe(res);
  });
}
function safeJoin(root, rel) {
  const p = path.normalize(path.join(root, decodeURIComponent(rel)));
  return p.startsWith(root) ? p : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  if (req.method === "POST" && p === "/api/generate") return handleGenerate(req, res);
  if (p === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, provider: providerName, model: provider.model, keyConfigured: Boolean(provider.key) }));
  }
  if (p === "/api/program") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(PROGRAM));
  }
  if (p === "/legacy" || p === "/legacy/") return serveFile(res, path.join(LEGACY_ROOT, "index.html"));
  if (p.startsWith("/assets/") || p.startsWith("/_next/")) {
    const f = safeJoin(LEGACY_ROOT, p);
    return f ? serveFile(res, f) : (res.writeHead(403), res.end());
  }
  const f = safeJoin(PUBLIC, p === "/" ? "/index.html" : p);
  return f ? serveFile(res, f) : (res.writeHead(403), res.end());
});

server.listen(PORT, () => {
  console.log(`Learnbay Generative UI  →  http://localhost:${PORT}`);
  console.log(`LLM provider: ${providerName} (${provider.model})${provider.key ? " [key set]" : ""}`);
  console.log(`Legacy page mirror     →  http://localhost:${PORT}/legacy`);
});

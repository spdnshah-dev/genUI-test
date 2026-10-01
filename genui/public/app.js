/* App orchestration: intent → streamed component specs → rendered page. */
(async function () {
  const $ = (s, r = document) => r.querySelector(s);
  const body = document.body;
  const stage = $("#stage"), form = $("#intent-form"), input = $("#intent"), go = $("#go"), status = $("#status"), statusText = $("#status-text");
  const traceList = $("#trace-list"), tracePanel = $("#trace"), llmPill = $("#llm-pill"), llmLabel = $("#llm-label");
  const { registry, esc, el } = window.GenUI;

  const PERSONAS = ["a software developer", "a data / business analyst", "a manager or team lead", "switching from a non-tech role", "a fresher"];
  const STARTERS = ["Give me a 60-second overview", "What are the fees and EMI options?", "Show me the GenAI & Agentic AI terms", "Which projects will I build?", "Am I eligible with 2 years in QA?", "How does placement support work?"];
  const PLACEHOLDERS = ["Ask anything: 'Plan my 13 months around a full-time job'", "Try: 'Compare this with other programs'", "Try: 'I'm a Java developer, which terms matter most?'", "Try: 'Show certifications and who issues them'"];

  const state = { persona: "", history: [], data: null, generating: false, lastIntent: "", online: null, abort: null };

  /* ---------- data ---------- */
  state.data = await fetch("/data/program.json").then((r) => r.json());

  /* ---------- chrome ---------- */
  const personas = $("#personas");
  PERSONAS.forEach((p) => {
    const b = el(`<button type="button" class="chip" aria-pressed="false">${esc(p)}</button>`);
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      personas.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", String(on)); state.persona = on ? p : "";
      if (body.dataset.state !== "idle" && state.lastIntent) generate(state.lastIntent, { nocache: true });
    });
    personas.appendChild(b);
  });
  const starters = $("#starters");
  STARTERS.forEach((q) => { const b = el(`<button type="button" class="chip" data-ask="${esc(q)}">${esc(q)}</button>`); starters.appendChild(b); });

  let ph = 0; input.placeholder = PLACEHOLDERS[0];
  setInterval(() => { if (document.activeElement !== input) input.placeholder = PLACEHOLDERS[(++ph) % PLACEHOLDERS.length]; }, 4200);

  document.addEventListener("click", (e) => {
    const ask = e.target.closest("[data-ask]");
    if (ask) { e.preventDefault(); input.value = ask.dataset.ask; generate(ask.dataset.ask); }
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); const q = input.value.trim(); if (q) generate(q); });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.focus(); input.select(); }
    if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    if (e.key.toLowerCase() === "r" && document.activeElement !== input && state.lastIntent && !state.generating) generate(state.lastIntent, { nocache: true });
    if (e.key === "Escape") tracePanel.hidden = true, $("#trace-toggle").setAttribute("aria-pressed", "false");
  });
  $("#trace-toggle").addEventListener("click", (e) => { tracePanel.hidden = !tracePanel.hidden; e.currentTarget.setAttribute("aria-pressed", String(!tracePanel.hidden)); });
  $("#trace-close").addEventListener("click", () => { tracePanel.hidden = true; $("#trace-toggle").setAttribute("aria-pressed", "false"); });

  /* voice input */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $("#mic");
  if (!SR) mic.hidden = true;
  else mic.addEventListener("click", () => {
    const r = new SR(); r.lang = "en-IN"; r.interimResults = false; mic.classList.add("listening");
    r.onresult = (ev) => { input.value = ev.results[0][0].transcript; generate(input.value); };
    r.onend = () => mic.classList.remove("listening"); r.onerror = () => mic.classList.remove("listening"); r.start();
  });

  /* ---------- trace ---------- */
  const t0 = () => performance.now();
  let tStart = 0;
  function trace(kind, text, cls = "k") {
    const li = el(`<li><span class="t">+${((t0() - tStart) / 1000).toFixed(2)}s</span><span><span class="${cls}">${esc(kind)}</span> ${esc(text)}</span></li>`);
    traceList.appendChild(li); traceList.scrollTop = traceList.scrollHeight;
  }

  /* ---------- health ---------- */
  async function health() {
    try {
      const h = await fetch("/api/health").then((r) => r.json());
      state.online = true; llmPill.dataset.state = "online"; llmLabel.textContent = `${h.provider} · ${h.model}`;
    } catch { state.online = false; llmPill.dataset.state = "offline"; llmLabel.textContent = "offline composer"; }
  }
  await health();

  /* ---------- rendering ---------- */
  function applyTheme(p) {
    if (p.mood && ["nebula", "aurora", "ember", "mono"].includes(p.mood)) body.dataset.mood = p.mood;
    const ok = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
    body.style.setProperty("--accent", ok(p.accent) ? p.accent : "");
    body.style.setProperty("--accent-2", ok(p.accent2) ? p.accent2 : "");
  }
  let order = 0;
  function render(comp) {
    if (comp.type === "theme") { applyTheme(comp.props || {}); trace("theme", JSON.stringify(comp.props)); return; }
    const fn = registry[comp.type];
    if (!fn) { trace("skip", `unknown component "${comp.type}"`, "e"); return; }
    try {
      const node = fn(comp.props || {}, state.data, comp.reason);
      node.style.animationDelay = `${Math.min(order++ * 40, 200)}ms`;
      stage.appendChild(node);
      trace(comp.type, comp.reason || "");
    } catch (err) { trace("render-error", `${comp.type}: ${err.message}`, "e"); }
  }

  /* ---------- generation ---------- */
  async function* streamFromServer(payload) {
    const ctrl = new AbortController(); state.abort = ctrl;
    const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
    if (!res.ok || !res.body) throw new Error(`generate HTTP ${res.status}`);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) { try { yield JSON.parse(line); } catch { /* ignore */ } } }
    }
  }

  async function generate(intent, opts = {}) {
    if (state.generating && state.abort) state.abort.abort();
    state.generating = true; state.lastIntent = intent; order = 0; tStart = t0();
    body.dataset.state = "generating"; go.disabled = true; status.hidden = false; statusText.textContent = "Composing your page…";
    stage.innerHTML = ""; traceList.innerHTML = ""; window.scrollTo({ top: 0, behavior: "smooth" });
    trace("intent", intent); if (state.persona) trace("persona", state.persona);
    const payload = { intent, persona: state.persona, history: state.history.slice(-4), nocache: Boolean(opts.nocache) };
    let count = 0, usedFallback = false;
    try {
      for await (const evt of streamFromServer(payload)) {
        if (evt.type === "meta") { trace("model", `${evt.props.provider} · ${evt.props.model}${evt.props.cached ? " · cached" : ""}`); llmPill.dataset.state = "online"; continue; }
        if (evt.type === "done") { trace("done", `${evt.props.count} components`); continue; }
        if (evt.type === "error") { trace("error", evt.props.message, "e"); if (!count) throw new Error(evt.props.message); continue; }
        render(evt); count++;
        statusText.textContent = `Materializing ${evt.type}…`;
        if (count === 1) body.dataset.state = "composed";
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      trace("fallback", `LLM unavailable (${err.message}); composing locally`, "e");
      llmPill.dataset.state = "offline"; llmLabel.textContent = "offline composer";
      usedFallback = true;
    }
    if (!count) {
      stage.innerHTML = "";
      for (const comp of window.GenUIFallback.compose(intent, state.persona, state.data)) { render(comp); count++; await new Promise((r) => setTimeout(r, 90)); if (count === 1) body.dataset.state = "composed"; }
      if (!usedFallback) trace("fallback", "model returned nothing usable; composed locally", "e");
    }
    if (!state.history.includes(intent)) state.history.push(intent);
    state.generating = false; go.disabled = false; status.hidden = true; body.dataset.state = "composed";
  }

  /* ---------- neural backdrop ---------- */
  (function neural() {
    const c = $("#neural"), ctx = c.getContext("2d"); let w, h, pts = [];
    const resize = () => { w = c.width = innerWidth * devicePixelRatio; h = c.height = innerHeight * devicePixelRatio; pts = Array.from({ length: Math.min(90, Math.floor(innerWidth / 14)) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25 * devicePixelRatio, vy: (Math.random() - 0.5) * 0.25 * devicePixelRatio })); };
    addEventListener("resize", resize); resize();
    const color = () => getComputedStyle(body).getPropertyValue("--accent-3").trim() || "#37e4d8";
    (function frame() {
      ctx.clearRect(0, 0, w, h); const col = color();
      for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
      ctx.lineWidth = devicePixelRatio * 0.6;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y), max = 150 * devicePixelRatio;
        if (d < max) { ctx.strokeStyle = col; ctx.globalAlpha = (1 - d / max) * 0.35; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      ctx.globalAlpha = 0.9; ctx.fillStyle = col;
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * devicePixelRatio, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1; requestAnimationFrame(frame);
    })();
  })();

  /* ---------- boot: honour ?q= deep links, otherwise wait for the visitor ---------- */
  const q = new URLSearchParams(location.search).get("q");
  if (q) { input.value = q; generate(q); }
  window.GenUIApp = { generate, state };
})();

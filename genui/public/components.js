/* Component registry: turns a {type, props} spec from the LLM into DOM. */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const inr = (n) => "₹ " + Math.round(n).toLocaleString("en-IN");
  const highlight = (text, part) => {
    text = String(text || ""); part = String(part || "");
    if (!part || !text.toLowerCase().includes(part.toLowerCase())) return esc(text);
    const i = text.toLowerCase().indexOf(part.toLowerCase());
    return esc(text.slice(0, i)) + '<span class="hl">' + esc(text.slice(i, i + part.length)) + "</span>" + esc(text.slice(i + part.length));
  };
  const ACTIONS = { apply: "https://www.learnbay.co/master-application", demo: "https://www.learnbay.co/demo", syllabus: "https://www.learnbay.co/datascience/data-science-and-ai-master-certification-program" };
  const actionBtn = (c, solid) => {
    if (c.action === "ask") return `<button class="btn ${solid ? "solid" : ""}" data-ask="${esc(c.ask || c.label)}">${esc(c.label)} ⌁</button>`;
    return `<a class="btn ${solid ? "solid" : ""}" href="${ACTIONS[c.action] || ACTIONS.apply}" target="_blank" rel="noopener">${esc(c.label)} ↗</a>`;
  };
  const wrap = (cls, inner, reason) => el(`<section class="block ${cls}">${reason ? `<span class="why" title="${esc(reason)}">⌁ why</span>` : ""}${inner}</section>`);

  const R = {};

  R.hero = (p, d, reason) => {
    const ctas = (p.ctas || []).slice(0, 3).map((c, i) => actionBtn(c, i === 0)).join("");
    const badges = (p.badges || []).slice(0, 4).map((b) => `<span class="badge">${esc(b)}</span>`).join("");
    const logos = d.certifiers.map((c) => `<img src="${c.logo}" alt="${esc(c.name)}" loading="lazy" />`).join("");
    return wrap("hero", `
      <div class="hero-orb"></div>
      <p class="eyebrow">${esc(p.eyebrow || d.tagline)}</p>
      <h2>${highlight(p.headline || d.name, p.highlight)}</h2>
      <p class="sub">${esc(p.sub || d.subtitle)}</p>
      <div class="badges">${badges}</div>
      <div class="ctas">${ctas || actionBtn({ label: "Apply now", action: "apply" }, true)}</div>
      <div class="hero-logos"><span>Certified with</span>${logos}</div>`, reason);
  };

  R.stats = (p, d, reason) => {
    const items = (p.items && p.items.length ? p.items : d.stats).slice(0, 6);
    return wrap("", `<div class="stats">${items.map((s) => `<div class="stat"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`).join("")}</div>`, reason);
  };

  R.insight = (p, d, reason) => wrap(`insight ${esc(p.tone || "info")}`, `
    <p class="eyebrow">Tailored for you</p>
    <h2>${esc(p.title || "Insight")}</h2>
    <p class="lead">${esc(p.body || "")}</p>
    ${p.bullets?.length ? `<ul>${p.bullets.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}`, reason);

  R.pillars = (p, d, reason) => {
    const items = (p.items && p.items.length ? p.items : d.pillars).slice(0, 6);
    return wrap("", `<h2>${esc(p.title || "From learning to placement")}</h2><div class="grid grid-2" style="margin-top:14px">${items.map((x) => `<div class="card"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join("")}</div>`, reason);
  };

  R.curriculum = (p, d, reason) => {
    const want = Array.isArray(p.terms) && p.terms.length ? new Set(p.terms) : null;
    const emph = new Set(p.emphasis || []);
    const terms = d.curriculum.filter((t) => !want || want.has(t.id));
    const rows = terms.map((t) => `
      <div class="term ${emph.has(t.id) ? "emph" : ""}">
        <div class="when">${esc(t.term)}<small>${esc(t.duration)}</small></div>
        <details ${emph.has(t.id) ? "open" : ""}><summary>${esc(t.title)}</summary>
          <div class="chapters">${t.chapters.slice(0, 8).map((c) => `<div class="chapter"><b>${esc(c.title)}</b><span>${esc(c.topics.slice(0, 4).join(" · "))}</span></div>`).join("")}</div>
        </details>
      </div>`).join("");
    return wrap("", `<p class="eyebrow">${terms.length} of ${d.curriculum.length} terms</p><h2>${esc(p.title || "Curriculum")}</h2><div class="timeline" style="margin-top:14px">${rows}</div>`, reason);
  };

  R.chart = (p, d, reason) => {
    let series = Array.isArray(p.series) && p.series.length ? p.series : d.curriculum.slice(1).map((t) => ({ label: t.title, value: parseFloat(t.duration) || 0.5, unit: "mo" }));
    series = series.slice(0, 14).map((s) => ({ ...s, value: Number(s.value) || 0 }));
    const max = Math.max(...series.map((s) => s.value), 1);
    const node = wrap("", `<h2>${esc(p.title || "Time per term")}</h2><div class="bars">${series.map((s) => `<div class="bar"><span>${esc(s.label)}</span><div class="track"><div class="fill" data-w="${(s.value / max) * 100}"></div></div><span class="num">${esc(s.value)} ${esc(s.unit || "")}</span></div>`).join("")}</div>`, reason);
    requestAnimationFrame(() => setTimeout(() => node.querySelectorAll(".fill").forEach((f) => (f.style.width = f.dataset.w + "%")), 60));
    return node;
  };

  R.projects = (p, d, reason) => {
    const ids = Array.isArray(p.ids) && p.ids.length ? p.ids : d.projects.map((_, i) => i);
    const items = ids.map((i) => d.projects[i]).filter(Boolean);
    return wrap("", `<p class="eyebrow">AI Co-Lab · industry projects</p><h2>${esc(p.title || "Build what startups actually need")}</h2><div class="grid grid-3" style="margin-top:14px">${items.map((x) => `
      <div class="card project"><img class="logo" src="${x.image}" alt="${esc(x.company)}" loading="lazy" /><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p><span class="outcome">Outcome · ${esc(x.outcome)}</span></div>`).join("")}</div>`, reason);
  };

  const marquee = (cls, items) => `<div class="marquee"><div class="marquee-track">${items.concat(items).join("")}</div></div>`;
  R.tools = (p, d, reason) => wrap("", `<h2>${esc(p.title || "Languages, tools & frameworks")}</h2><div style="margin-top:14px">${marquee("tool", d.tools.map((t) => `<span class="tool">${esc(t)}</span>`))}</div>`, reason);
  R.companies = (p, d, reason) => wrap("", `<p class="eyebrow">Alumni in 350+ companies</p><h2>${esc(p.title || "Where our learners work")}</h2><div style="margin-top:14px">${marquee("logo", d.companies.map((c) => `<div class="logo-card"><img src="${c.logo}" alt="${esc(c.name)}" loading="lazy" /></div>`))}</div>`, reason);

  R.certifications = (p, d, reason) => {
    const ids = Array.isArray(p.ids) && p.ids.length ? new Set(p.ids) : null;
    const items = d.certifications.filter((c) => !ids || ids.has(c.id));
    return wrap("", `<h2>${esc(p.title || "Industry-recognized certifications")}</h2><div class="grid grid-2" style="margin-top:14px">${items.map((c) => `
      <div class="card cert"><img src="${c.image}" alt="${esc(c.title)}" loading="lazy" /><div><p class="eyebrow">${esc(c.issuer)}</p><h3>${esc(c.title)}</h3><ul>${c.points.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>`).join("")}</div>`, reason);
  };

  R.pricing = (p, d, reason) => {
    const pr = d.pricing; const total = pr.fee * (1 + pr.gstPercent / 100);
    const months = [3, 6, 9, 12, 18].includes(Number(p.months)) ? Number(p.months) : 12;
    const node = wrap("", `
      <div class="pricing-grid">
        <div>
          <p class="eyebrow">Fee & batch details</p>
          <h2>Live online classes</h2>
          <div class="price">${esc(pr.feeDisplay)}<small>+ ${pr.gstPercent}% GST</small></div>
          <p style="margin-top:8px">${esc(p.note || pr.emi + ". " + pr.scholarship + ".")}</p>
          <ul class="checks">${pr.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
        </div>
        <div class="emi">
          <p class="eyebrow">No-cost EMI planner</p>
          <div class="monthly" data-monthly>—</div>
          <p style="font-size:13px">per month, incl. GST · <span data-months>${months}</span> months</p>
          <input type="range" min="3" max="18" step="3" value="${months}" aria-label="EMI tenure in months" />
          <div class="meta"><span>3 mo</span><span>Total ${inr(total)}</span><span>18 mo</span></div>
          <p style="font-size:12.5px;margin-top:10px">${esc(pr.loan)}. ${esc(pr.groupDiscount)}.</p>
        </div>
      </div>`, reason);
    const range = node.querySelector("input"); const out = node.querySelector("[data-monthly]"); const mo = node.querySelector("[data-months]");
    const update = () => { out.textContent = inr(total / Number(range.value)); mo.textContent = range.value; };
    range.addEventListener("input", update); update();
    return node;
  };

  R.comparison = (p, d, reason) => wrap("", `<h2>${esc(p.title || "Others vs Learnbay")}</h2><div class="table-wrap" style="margin-top:14px"><table class="table"><thead><tr><th>Feature</th><th>Learnbay</th><th>Other programs</th></tr></thead><tbody>${d.comparison.map((r) => `<tr><td>${esc(r.feature)}</td><td class="lb">${esc(r.learnbay)}</td><td class="ot">${esc(r.others)}</td></tr>`).join("")}</tbody></table></div>`, reason);

  R.roadmap = (p, d, reason) => {
    const steps = (Array.isArray(p.steps) && p.steps.length ? p.steps : d.admission.map((a, i) => ({ when: `Step ${i + 1}`, label: a.step, text: a.text }))).slice(0, 10);
    return wrap("", `<p class="eyebrow">Your plan</p><h2>${esc(p.title || "A roadmap built for you")}</h2><div class="steps">${steps.map((s) => `<div class="step"><span class="when">${esc(s.when)}</span><span class="node"></span><div><h3>${esc(s.label)}</h3><p>${esc(s.text)}</p></div></div>`).join("")}</div>`, reason);
  };

  R.eligibility = (p, d, reason) => {
    const roles = d.eligibility.roles.concat(["Data / Business Analyst", "Non-tech professional", "Student / Fresher"]);
    const node = wrap("", `
      <p class="eyebrow">Interactive check</p><h2>Am I eligible?</h2>
      <p>${esc(d.eligibility.description)}</p>
      <div class="elig" style="margin-top:14px">
        <label>Current role<select data-role>${roles.map((r) => `<option ${r === p.prefillRole ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
        <label>Experience<select data-exp>${d.eligibility.experienceBands.map((r) => `<option ${r === p.prefillExperience ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
        <div class="verdict" data-verdict></div>
      </div>`, reason);
    const role = node.querySelector("[data-role]"), exp = node.querySelector("[data-exp]"), v = node.querySelector("[data-verdict]");
    const judge = () => {
      const fresher = exp.value === "Freshers" || /fresher/i.test(role.value);
      v.className = "verdict " + (fresher ? "no" : "ok");
      v.innerHTML = fresher
        ? `<b>Not yet.</b> ${esc(d.eligibility.note)} Explore the <a class="hl" href="https://www.learnbay.co/data-science-courses" target="_blank" rel="noopener">fresher-friendly programs</a> instead.`
        : `<b>You qualify.</b> ${esc(role.value)} with ${esc(exp.value)} fits the program. ${/non-tech/i.test(role.value) ? "Module 0 (Python bootcamp) brings you up to speed before Term 1." : "Your tech background means Term 1 will move fast; consider the DSA elective in Term 11."} <button class="chip" data-ask="Show me a month-by-month plan for a ${esc(role.value)} with ${esc(exp.value)} experience">Build my plan ⌁</button>`;
    };
    role.addEventListener("change", judge); exp.addEventListener("change", judge); judge();
    return node;
  };

  R.faq = (p, d, reason) => {
    let items = Array.isArray(p.ids) && p.ids.length ? p.ids.map((i) => d.faq[i]).filter(Boolean) : d.faq;
    items = items.slice(0, Number(p.limit) || 6);
    return wrap("", `<h2>${esc(p.title || "Questions people like you ask")}</h2><div class="faq-list" style="margin-top:14px">${items.map((f, i) => `<details class="faq-item" ${i === 0 ? "open" : ""}><summary><span><span class="sec">${esc(f.section)}</span><br />${esc(f.q)}</span></summary><p>${esc(f.a)}</p></details>`).join("")}</div>`, reason);
  };

  R.testimonials = (p, d, reason) => wrap("", `<p class="eyebrow">Real stories</p><h2>${esc(p.title || "What learners say")}</h2><div class="grid grid-3" style="margin-top:14px">${d.testimonials.map((t) => `<div class="card"><p class="quote">${esc(t.text)}</p><p style="margin-top:10px;font-size:13px;color:var(--ink-3)">— ${esc(t.name)}</p></div>`).join("")}</div>`, reason);
  R.mentors = (p, d, reason) => wrap("", `<p class="eyebrow">Mentorship</p><h2>${esc(p.title || "Mentors guiding every step")}</h2><div class="grid grid-3" style="margin-top:14px">${d.mentors.map((m) => `<div class="card person"><img src="${m.photo}" alt="${esc(m.name)}" loading="lazy" /><div><b>${esc(m.name)}</b><span>${esc(m.tag)}</span></div></div>`).join("")}</div>`, reason);
  R.placement = (p, d, reason) => wrap("", `<p class="eyebrow">From day one to dream role</p><h2>${esc(p.title || "Placement support")}</h2><div class="grid grid-2" style="margin-top:14px">${d.placement.map((x) => `<div class="card"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join("")}</div>`, reason);
  R.admission = (p, d, reason) => wrap("", `<h2>${esc(p.title || "3-step admission")}</h2><div class="admission" style="margin-top:14px">${d.admission.map((a) => `<div class="card"><h3>${esc(a.step)}</h3><p>${esc(a.text)}</p></div>`).join("")}</div>`, reason);

  R.cta = (p, d, reason) => wrap("cta", `<h2>${esc(p.title || "Ready to make your experience count?")}</h2><p>${esc(p.text || d.description)}</p>${actionBtn({ label: p.buttonLabel || "Start your application", action: p.action || "apply", ask: p.ask }, true)}`, reason);

  R.suggestions = (p, d, reason) => wrap("suggest", `<p class="eyebrow">Keep exploring</p><div class="chips">${(p.items || []).slice(0, 5).map((s) => `<button class="chip" data-ask="${esc(s)}">${esc(s)} ⌁</button>`).join("")}</div>`, reason);

  R.error = (p) => wrap("error", `<p class="eyebrow">Generator notice</p><p>${esc(p.message)}</p>`);

  window.GenUI = { registry: R, esc, el };
})();

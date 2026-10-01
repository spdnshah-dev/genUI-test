/* Offline composer: a deterministic intent → components planner used when no LLM is reachable. */
(function () {
  const has = (s, ...words) => words.some((w) => s.includes(w));
  function compose(intent, persona, data) {
    const s = (intent + " " + persona).toLowerCase();
    const out = [];
    const push = (type, props, reason) => out.push({ type, props, reason });
    const mood = has(s, "fee", "price", "emi", "cost") ? "aurora" : has(s, "project", "build", "genai", "agentic") ? "ember" : "nebula";
    push("theme", { mood }, "mood chosen from your intent");

    if (has(s, "fee", "price", "emi", "cost", "scholarship", "discount")) {
      push("hero", { eyebrow: "Transparent pricing", headline: "One fee. No-cost EMI. A 3-year flexi pass.", highlight: "No-cost EMI", sub: "Everything the program includes, and what it costs per month.", badges: ["₹1,59,000 + GST", "EMI up to 18 months", "3-year access"], ctas: [{ label: "Check EMI options", action: "apply" }, { label: "Compare with others", action: "ask", ask: "How does Learnbay compare with other programs?" }] }, "you asked about fees");
      push("pricing", { months: 12 }, "interactive EMI planner");
      push("faq", { ids: data.faq.map((f, i) => (f.section.includes("Payments") ? i : -1)).filter((i) => i >= 0) }, "payment FAQs");
      push("comparison", {}, "value for money context");
      push("cta", { title: "Talk to a counsellor about scholarships", text: "Early-bird and group discounts change by batch; a counsellor can confirm the current offer.", buttonLabel: "Book a free consultation", action: "demo" }, "next step");
    } else if (has(s, "curriculum", "syllabus", "module", "term", "learn", "topics", "cover")) {
      push("hero", { eyebrow: "Curriculum", headline: "13 terms from Python to Agentic AI and MLOps", highlight: "Agentic AI", sub: "Live, mentor-led terms engineered to meet the expectations of leading tech companies.", badges: ["370+ live hours", "13 terms", "Domain electives"], ctas: [{ label: "Download syllabus", action: "syllabus" }, { label: "Which terms matter for GenAI?", action: "ask", ask: "Which terms should I focus on for a GenAI engineer role?" }] }, "you asked about the curriculum");
      push("chart", { title: "Months per term" }, "see where time goes");
      push("curriculum", { mode: "timeline", emphasis: ["t3", "t4"] }, "full term list, GenAI terms expanded");
      push("tools", {}, "tools you will use");
      push("cta", { title: "Want this mapped to your role?", text: "Tell the page your current role and experience and it will build a term-by-term plan.", buttonLabel: "Build my plan", action: "ask", ask: "Build me a personalized study plan" }, "personalize next");
    } else if (has(s, "project", "capstone", "co-lab", "colab", "hands-on", "build")) {
      push("hero", { eyebrow: "AI Co-Lab", headline: "Solve real startup problems, not case studies", highlight: "real startup problems", sub: "12 real-time projects, 3 capstones, and certificates issued by the startups you build for.", badges: ["12 real-time projects", "3 capstones", "Startup certificates"], ctas: [{ label: "Start your application", action: "apply" }, { label: "See certifications", action: "ask", ask: "What certifications do I get?" }] }, "you asked about projects");
      push("projects", {}, "the project catalogue");
      push("pillars", { items: data.pillars.slice(2) }, "GenAI tooling and Co-Lab");
      push("faq", { ids: data.faq.map((f, i) => (f.section.includes("Capstone") ? i : -1)).filter((i) => i >= 0) }, "project FAQs");
    } else if (has(s, "eligib", "qualify", "fresher", "experience", "can i", "am i", "switch", "non-tech", "career")) {
      push("hero", { eyebrow: "Eligibility", headline: "Built for working professionals with 1+ year of experience", highlight: "1+ year", sub: data.eligibility.description, badges: ["Min 1 year experience", "No coding required to start", "Module 0 bootcamp"], ctas: [{ label: "Check eligibility", action: "apply" }, { label: "Show me the curriculum", action: "ask", ask: "Show me the curriculum" }] }, "you asked whether you qualify");
      push("eligibility", {}, "interactive eligibility check");
      push("roadmap", { title: "A typical 13-month path", steps: [{ when: "Month 0", label: "Induction", text: "Orientation, career-path mapping and LinkedIn optimisation." }, { when: "Months 1-4", label: "Python & foundations", text: "Terms 1-2: Python for GenAI and ML/NLP foundations." }, { when: "Months 5-9", label: "GenAI & Agentic AI", text: "Terms 3-4: LLMs, RAG, agents and autonomous systems." }, { when: "Months 10-13", label: "Data science depth & MLOps", text: "Terms 5-10: statistics, advanced DS, deployment, analytics, SQL and big data." }, { when: "After", label: "Placement support", text: "Mock interviews, resume build-up and at least 10 interview calls." }] }, "what the journey looks like");
      push("faq", { ids: data.faq.map((f, i) => (f.section.includes("Course") ? i : -1)).filter((i) => i >= 0), limit: 4 }, "course FAQs");
    } else if (has(s, "placement", "job", "hiring", "salary", "company", "companies", "interview")) {
      push("hero", { eyebrow: "Placement", headline: "Alumni in 350+ companies. You're next.", highlight: "350+ companies", sub: "Dedicated placement support with mock interviews, resume build-up and at least 10 interview calls.", badges: ["Mock interviews", "Resume build-up", "Referrals for 1 year"], ctas: [{ label: "Start your application", action: "apply" }, { label: "What's the eligibility for job assistance?", action: "ask", ask: "What is the eligibility for job assistance?" }] }, "you asked about jobs");
      push("companies", {}, "where alumni work");
      push("placement", {}, "the support you get");
      push("testimonials", {}, "social proof");
      push("faq", { ids: data.faq.map((f, i) => (f.section.includes("Job") ? i : -1)).filter((i) => i >= 0) }, "job assistance FAQs");
    } else if (has(s, "compare", "vs", "other", "why learnbay", "better", "different")) {
      push("hero", { eyebrow: "Why Learnbay", headline: "Live, mentor-led, domain-specialised, startup-certified", highlight: "startup-certified", sub: "What sets this program apart from recorded, generic alternatives.", badges: ["3-year flexi pass", "Dedicated project mentor", "Hybrid mode"], ctas: [{ label: "Apply now", action: "apply" }] }, "you asked for a comparison");
      push("comparison", {}, "side-by-side");
      push("pillars", {}, "the four pillars");
      push("certifications", {}, "credentials you earn");
    } else if (has(s, "certif", "ibm", "microsoft")) {
      push("hero", { eyebrow: "Certifications", headline: "Certified by IBM, Microsoft and the startups you build for", highlight: "IBM, Microsoft", sub: "Course completion, GenAI, Microsoft collaboration and capstone certificates.", badges: ["IBM", "Microsoft", "Startup project certificates"], ctas: [{ label: "Apply now", action: "apply" }] }, "you asked about certificates");
      push("certifications", {}, "every certificate");
      push("faq", { ids: data.faq.map((f, i) => (f.section.includes("Certif") ? i : -1)).filter((i) => i >= 0) }, "certification FAQs");
    } else {
      push("hero", { eyebrow: data.tagline, headline: data.name, highlight: "GenAI Master", sub: data.subtitle, badges: ["370+ live hours", "13 terms", "350+ alumni companies", "IBM & Microsoft certified"], ctas: [{ label: "Start your application", action: "apply" }, { label: "Am I eligible?", action: "ask", ask: "Am I eligible for this program?" }, { label: "Show fees", action: "ask", ask: "What are the fees and EMI options?" }] }, "a first look at the program");
      push("stats", {}, "the numbers that matter");
      push("pillars", {}, "what you get");
      push("curriculum", { mode: "timeline", emphasis: ["t3"] }, "the full curriculum");
      push("projects", { ids: [0, 2, 3] }, "sample projects");
      push("companies", {}, "alumni outcomes");
      push("pricing", { months: 12 }, "fees with EMI planner");
      push("cta", { title: "Make your experience count", text: data.description, buttonLabel: "Start your application", action: "apply" }, "next step");
    }
    push("suggestions", { items: ["What are the fees and EMI options?", "Show me the curriculum", "Which projects will I build?", "Am I eligible?", "How does placement support work?"].filter((q) => !s.includes(q.toLowerCase().slice(0, 12))).slice(0, 4) }, "keep exploring");
    return out;
  }
  window.GenUIFallback = { compose };
})();

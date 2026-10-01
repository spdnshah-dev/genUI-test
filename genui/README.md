# Learnbay · Generative UI page

A replica of the **Data Science & GenAI Master Certification Program** page with no fixed layout.
Every visit starts from a single question. An LLM reads the visitor's intent and persona, then
streams back a sequence of UI components chosen from a catalog. The browser materializes each
one as it arrives, so the page is composed live around what the visitor wants.

```
visitor intent ──▶ POST /api/generate ──▶ LLM (NDJSON component stream)
                                              │
           ┌──────────────────────────────────┘
           ▼
 {"type":"hero",...}  {"type":"eligibility",...}  {"type":"roadmap",...}  {"type":"pricing",...}
           │
           ▼
 components.js registry renders each spec into DOM (with the program's real data)
```

## Run it

Requires Node 18+ (uses the built-in `fetch`). No npm install.

```bash
cd genui
node server.js
# open http://localhost:3000
```

By default it uses **Pollinations** (`https://text.pollinations.ai`), a free OpenAI-compatible
endpoint that needs no API key. Other providers:

| Provider | Command |
| --- | --- |
| Pollinations (default, free, no key) | `node server.js` |
| Groq (free tier) | `LLM_PROVIDER=groq LLM_API_KEY=gsk_... node server.js` |
| OpenRouter (free models) | `LLM_PROVIDER=openrouter LLM_API_KEY=sk-or-... node server.js` |
| Ollama (fully local) | `LLM_PROVIDER=ollama LLM_MODEL=llama3.2 node server.js` |
| OpenAI | `LLM_PROVIDER=openai LLM_API_KEY=sk-... node server.js` |
| Any OpenAI-compatible URL | `LLM_PROVIDER=custom LLM_BASE_URL=https://host/v1/chat/completions LLM_MODEL=... node server.js` |

Other env: `PORT` (default 3000), `DEBUG=1` (logs raw model output when parsing fails).

If the LLM is unreachable the page still works: `public/fallback.js` is a deterministic
intent → components planner, and the status pill in the header switches to "offline composer".

## What the visitor can do

- Type any question or goal, or use voice input (Web Speech API where available).
- Pick a persona chip; the page regenerates for that persona.
- Click any "⌁" button inside a generated block to ask a follow-up; the previous intents are sent as session context.
- Press `Ctrl/Cmd+K` to focus the prompt, `R` to regenerate, `Esc` to close the trace.
- Open **Trace** to watch the component stream with timings, the model used, and the reason the model gave for each block.
- Deep-link an intent with `?q=...`, e.g. `http://localhost:3000/?q=Am%20I%20eligible`.
- **Legacy page ↗** opens the pixel-exact mirror of the production page served at `/legacy`.

## Component catalog

`theme`, `hero`, `stats`, `insight`, `pillars`, `curriculum` (13 terms, expandable), `chart`,
`projects`, `tools`, `companies`, `certifications`, `pricing` (interactive no-cost EMI planner),
`comparison`, `roadmap`, `eligibility` (interactive checker), `faq`, `testimonials`, `mentors`,
`placement`, `admission`, `cta`, `suggestions`.

The model only selects, orders and personalizes copy. All facts (fees, durations, terms, FAQs,
partners) come from `public/data/program.json`, which was extracted from the production page's
`__NEXT_DATA__`, so the generator cannot invent prices or guarantees.

## Files

| Path | Purpose |
| --- | --- |
| `server.js` | Static server + `/api/generate` streaming proxy + provider config + in-memory cache |
| `public/index.html` | Shell: intent console, stage, trace drawer |
| `public/app.js` | Orchestration: streaming, rendering, personas, voice, keyboard, fallback hand-off, neural backdrop |
| `public/components.js` | Component registry (spec → DOM) |
| `public/fallback.js` | Offline composer |
| `public/styles.css` | Design system: moods (`nebula`, `aurora`, `ember`, `mono`), glass blocks, materialize animation |
| `public/data/program.json` | The program knowledge base |

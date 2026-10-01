# Learnbay – Data Science & GenAI Master Certification Program

Two versions of the same page live in this repo:

| Folder | What it is | Run |
| --- | --- | --- |
| `genui/` | **Generative UI replica.** No fixed layout: an LLM streams a component plan tailored to what the visitor asks, and the browser materializes it. Free LLM (Pollinations) by default, offline fallback built in. | `cd genui && node server.js` then open http://localhost:3000 |
| repo root | **Static mirror** of the production page (HTML, CSS, JS, fonts, images). It is the content source for the generator and is served at `/legacy` by the Gen UI server. | `python3 -m http.server 8080` |

See [`genui/README.md`](genui/README.md) for the Generative UI architecture, LLM providers and component catalog.

---

## Static mirror (legacy UI)

Static mirror of the production frontend for
https://www.learnbay.co/datascience/data-science-and-ai-master-certification-program
captured on 2026-10-01.

## Layout

| Path | Contents |
| --- | --- |
| `index.html` | The server-rendered page, rewritten to load every asset from this repo instead of the CloudFront CDN. |
| `_next/static/css/` | All 23 compiled stylesheets. |
| `_next/static/chunks/` | All Next.js / React / webpack runtime and page chunks (production, minified). |
| `_next/static/media/` | Web fonts (woff2). |
| `assets/` | Every image the page references (hero, logos, icons, mentor photos, project thumbnails, etc.), stored at the same path they had on the CDN. |
| `source/original-page.html` | The untouched HTML exactly as served by learnbay.co, kept for reference. |

## Changes made to the captured code

Only the minimum needed to make the page run from a local folder:

- CDN prefix `https://d32and0ii3b8oy.cloudfront.net/…` replaced with relative paths in the HTML, CSS and JS.
- `assetPrefix` in `__NEXT_DATA__` set to `""` and the webpack `publicPath` set to `_next/`.
- Next.js image loader switched to `unoptimized` so `<Image>` renders the local files instead of calling `/_next/image`.
- Internal links such as `/demo` or `/blogs` now point at `https://www.learnbay.co/...` so navigation still works.

## Run it

Any static file server works. From the repo root:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/
```

Google Tag Manager and the CRM/enquiry form endpoints still point at the live services, so analytics and form submissions behave as on production.

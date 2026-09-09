# BazarPeech — website

Single-page marketing site for BazarPeech, a systematic trading algorithm.
Rebuilt from scratch against the **Website Development Guide** (developer handoff,
v1.0, Sept 2026).

## Stack

Hand-written static site — no build step, no framework.

| File | Purpose |
|---|---|
| `index.html` | All 9 sections, semantic markup, JSON-LD, meta. Fully readable with JS off. |
| `styles.css` | Design tokens + every section style + responsive + reduced-motion. |
| `main.js` | Progressive enhancement only: header state, mobile menu, meeting dialog, reveal / count-up / draw-in animations (all `prefers-reduced-motion` aware). |
| `data.js` | Single source of truth for the **illustrative** demo values + the meeting endpoint. |
| `robots.txt` | Crawl rules. |

## Sections (IA)

1. Hero — headline, 0–1 direction meter, chart backdrop, CTA
2. Decision Layers — 5-card process strip
3. Trend Recognition — probability gauge + factor list
4. Trigger Signals — signal pipeline + chart marker
5. Money Management — position card + dynamic rules
6. Complete Engine — system flow diagram
7. Performance — metric tiles + equity curve + disclosure
8. Fundamental Intelligence — roadmap flow, **In development** badge
9. Business CTA + Footer — schedule a meeting + risk/legal

## Preview locally

```
python3 -m http.server 8145 --bind 0.0.0.0
```

Then open `http://localhost:8145/` (or `http://<your-LAN-ip>:8145/` from a phone
on the same Wi-Fi).

## Before publishing — required

- **Performance section is illustrative.** Every metric in `data.js` `performance`
  and the equity `path` in `index.html` must be replaced with verified figures
  traceable to one test dataset + methodology. See the yellow disclosure box.
- Market values / candles / score in the hero are illustrative, never labelled "live".
- Wire real `Privacy` / `Terms` pages (footer links are `#` placeholders).
- Fundamental Intelligence must stay marked **In development**; source names are
  "intended inputs" only until integrations + rights exist.

## Meeting form

The "Schedule a meeting" dialog POSTs `{ email }` to the endpoint in
`data.js` (`meetingEndpoint`, currently `/api/waitlist` — the existing
localhost Python service on the server that stores the address and notifies
Telegram).

## Deploy

Static files. The server serves the site from `/var/www/bazarpeech.com/public/`
(nginx). Copy `index.html`, `styles.css`, `main.js`, `data.js`, `robots.txt`
into that directory (back up the current `index.html` first).

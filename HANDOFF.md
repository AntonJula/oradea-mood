# Oradea Mood: handoff

State as of 18 November 2026, about 20:00 Europe/Bucharest. `origin/main` is at `16d842f` on https://github.com/AntonJula/oradea-mood. The local branch `emotii-extinse` adds a richer emotion model; see "Richer emotion model" below. It is not pushed.

## What the app is

People scan a QR code shown on a TV and write, in Romanian, how their evening is going. The server classifies each message with Claude Haiku (via OpenRouter):

- **one mood family for the TV bars.** On `main` there are 5: relaxat, energic, obosit, tensionat, neutru. On `emotii-extinse` there are 6, adding trist;
- **on `emotii-extinse` also:** a nuance, an intensity from 1 to 3, and up to two themes.

The TV shows the group portrait for the last 30 minutes. A map recommends places in Oradea that fit the current mood.

It is a single Node process. Contributions live in memory and are lost on restart. Only the places catalog is on disk (SQLite).

## Features on `main`

### Core app (Anton Jula, commits `8323318` and `90292fd`)

- **Phone form:** `/l/oradea`. Contributions are saved without an account and replaced from the same browser. You can withdraw your own contribution.
- **TV screen:** `/l/oradea/live`, with the QR code.
  - The portrait appears from 3 active contributions: one bar per mood family (5 on `main`, 6 on `emotii-extinse`), dominant mood or "Stare mixtă", themes, summary and suggestions.
  - Contributions expire after 30 minutes.
- **Rehearsal (demo mode only):** `/l/oradea/repetitie`, 21 scripted moments with fictional participants.
- **Home page:** `/`. Lobbies:
  - a demo lobby `oradea-demo` with 8 samples;
  - a fixed event lobby with code `LIGHTNING2` ("Lightning Hackathon #2");
  - user-created lobbies with a random code, opened at `/l/g/<CODE>`.
- **Limits:**
  - 3–280 characters per message, 4 KB per request body;
  - 15 seconds between messages from the same browser;
  - a per-IP limit set by `LIMITA_IP_MESAJE_PE_MINUT`;
  - batches of at most 20 messages for the AI.
- **Privacy and AI handling:**
  - IPs are kept only as salted HMACs;
  - the raw text is never on the dashboard;
  - messages are sent to the AI as untrusted data.
- **Tests:** `test/lobby.test.mjs`, `test/http.test.mjs`. QA notes are in `qa/RESULTS.md`.

### Map and places (rafael, commits `43e0828`, `00bd4e9`, `16d842f`)

- **Map page:** `/harta` (also `/l/oradea/harta`). Built on Leaflet 1.9.4, served locally from `node_modules`.
  - Default base map: Esri World Street Map, which looks like Google Maps. A toggle switches to Esri satellite with road and label overlays.
  - Pins are round, with an icon per place type. The name is shown next to each pin and colored by the place's best-fitting mood. Labels that would overlap are hidden.
  - The top 3 recommendations for the current Oradea mood are drawn larger, numbered, with a yellow ring.
  - Clicking a pin opens a card: type, area, description, fit for each mood, themes.
  - "Cum te simți tu?" ranks the places for a chosen mood and dims the rest.
  - Links to the map are on the form and on the TV page.
- **Places database:** `lib/places.mjs` uses `node:sqlite`. It is seeded and validated at startup from `data/locuri.json` into `data/oradea.db`, which is gitignored. Tables:
  - `cartiere` (area labels);
  - `locuri`;
  - `locuri_stari` (fit 0–1 for each mood);
  - `locuri_teme`;
  - `instantanee` (aggregate snapshots; nothing writes to it yet).
- **Catalog:** 16 places, including Piața Unirii, Cetatea, Parcul 1 Decembrie, Filarmonica, Strada Republicii, Lotus Center, Grădina Zoologică, Muzeul Țării Crișurilor, Palatul Moskovits and Bazilica Romano-Catolică.
  - Coordinates come from OpenStreetMap Nominatim, except two marked "aproximativ" in `sursa`.
- **Recommendation score:** Σ (mood percent × place fit for that mood), plus 0.12 for each theme shared with the group. Recommendations appear only once the lobby has a portrait (at least 3 contributions).
- **`GET /api/places`:** returns the places, the current Oradea state and the top 3 recommendations.
- **QR address:**
  - When `PUBLIC_BASE_URL` is empty or points to localhost, the server binds `0.0.0.0` and the QR uses the laptop's Wi-Fi IP (virtual WSL/VPN adapters are skipped). Example: `http://192.168.0.26:3000/l/oradea`.
  - When `PUBLIC_BASE_URL` is a real public URL, the server binds `HOST`, or `127.0.0.1` by default.
- **`npm run public` (`scripts/public.mjs`):**
  - starts a free cloudflared quick tunnel and reads its `https://….trycloudflare.com` address;
  - sets `PUBLIC_BASE_URL`, `HOST=127.0.0.1`, `TRUST_PROXY_ADDRESS=127.0.0.1` and `TRUST_PROXY_HEADER=cf-connecting-ip`;
  - starts the server, so anyone can scan the QR, from Wi-Fi or mobile data.
- **Node 22 support:** `server.mjs` now also runs directly on Node 22. It checks `process.argv[1]` when `import.meta.main` is missing.
- **CSP:** images are allowed only from `'self'`, `data:` and `https://server.arcgisonline.com`.

## Richer emotion model (branch `emotii-extinse`, local only)

- **Six mood families, one bar each on the TV:** relaxat, energic, obosit, tensionat, **trist** (new), neutru.
  - Sadness used to fall under obosit or neutru. It now has its own face on the TV (blue, frowning) and its own bar color.
- **Nuances:** 20 in total, each tied to one family (`NUANCES` in `lib/lobby.mjs`):

  | Family | Nuances |
  |---|---|
  | relaxat | calm, mulțumit, recunoscător |
  | energic | entuziasmat, bucuros, curios, motivat |
  | obosit | obosit, epuizat, plictisit |
  | tensionat | stresat, anxios, frustrat, iritat |
  | trist | trist, singur, nostalgic, dezamăgit |
  | neutru | neutru, pensiv |

- **Intensity:** 1 (ușoară), 2 (moderată) or 3 (puternică).
- **What the model returns** per message: `mood`, `emotion`, `intensity`, `themes`.
  - The family and the themes are validated strictly, as before.
  - A nuance that does not belong to the family becomes `null`, and a bad intensity becomes 2, so one bad field does not drop the whole batch.
  - The demo classifier detects nuances and intensity from keywords: "foarte"/"super"/"!!" means 3, "puțin"/"ușor" means 1.
- **New portrait fields** (still only from 3 active contributions):
  - `nuances`: the top 3, with percent. Ties prefer nuances of the dominant family;
  - `intensity`: the average and a label;
  - `climate`: valence and energy from -100 to 100, computed from family × intensity, with the labels tone (pozitiv/echilibrat/apăsat) and energie (ridicată/medie/scăzută).
- **On screen:** the TV interpretation panel shows a line such as "Nuanțe: singur 40%, trist 20%, calm 20% · intensitate puternică · ton echilibrat, energie medie". The automatic summary mentions the clearest nuance, or says the nuances are varied.
- **Places:** every place in `data/locuri.json` now has a `trist` fit. The schema check accepts it, and existing databases rebuild `locuri_stari` once, via `PRAGMA user_version = 2`.
  - The map has a sixth mood chip and pin color.
  - Recommendations use the 6-family distribution. A sad group gets the Crișul promenade, Parcul 1 Decembrie and the Basilica.
- **Privacy:** nuance percentages, like all other aggregates, appear only from 3 contributions. With 3–5 people a nuance can still point to one person, which the on-screen line "Grupurile mici nu sunt anonime" warns about.
- **Not changed:** rehearsal (21 moments, still 5 families), the home-page samples (no nuance or intensity) and the participant page.
- 17 tests pass, including a new test for sadness, nuances, intensity and climate.

## How to run

```powershell
cd C:\Users\Foica\Desktop\OradeaMood\oradea-mood
npm.cmd ci
npm.cmd test              # 16 tests
npm.cmd run demo          # local keyword classifier, no AI, rehearsal enabled
npm.cmd start             # live; reads .env
npm.cmd run public        # live + public HTTPS tunnel; reads ../.env then .env
npm.cmd run check:ai      # one fictitious message through OpenRouter
```

- **Node:** `package.json` asks for Node ≥ 24.2, but the laptop has Node 22.19. All scripts and tests work on 22.19. `node:sqlite` prints an ExperimentalWarning on 22, which is harmless.
- **cloudflared:** installed with winget, at `C:\Program Files (x86)\cloudflared\cloudflared.exe`. Set `CLOUDFLARED` to use another path.
- **Pages:**
  - TV: `http://localhost:3000/l/oradea/live`
  - map: `/harta`
  - home: `/`
- After changing files in `public/`, restart the server. Pages and assets are read into memory at startup.

## Configuration

The OpenRouter key is in `C:\Users\Foica\Desktop\OradeaMood\.env`, the folder above the clone. Only `npm run public` reads that file. `npm start` and `check:ai` read only the clone's `.env`. The clone's `.env` currently holds `DEMO_MODE=false` and `LIMITA_IP_MESAJE_PE_MINUT=30`. Both files are gitignored.

| Variable | Meaning |
|---|---|
| `OPENROUTER_API_KEY` | Server-side key. Without it, live analysis stays "delayed". |
| `AI_MODEL` | Default `anthropic/claude-haiku-5.5`. |
| `AI_FALLBACK_MODEL` | In `.env.example`, but the current code does not use it. |
| `DEMO_MODE` | `true`, or `npm run demo`, uses the local keyword classifier and enables rehearsal. |
| `PUBLIC_BASE_URL` | Origin for the QR. Empty means the LAN IP. `npm run public` sets it to the tunnel. |
| `HOST` / `PORT` | Used only when `PUBLIC_BASE_URL` is a public URL. Default `127.0.0.1` / `3000`. |
| `LIMITA_IP_MESAJE_PE_MINUT` | Messages per minute per IP. 5 by default, 30 for the event. |
| `TRUST_PROXY_ADDRESS` / `TRUST_PROXY_HEADER` | Trusted proxy for the client IP (`cf-connecting-ip` behind cloudflared). |
| `PLACES_DB` | Optional path for the SQLite file. Default `data/oradea.db`. |
| `CLOUDFLARED` | Optional path to the cloudflared binary. |

## Git state

- `origin/main` = `16d842f`. Local `main` is one commit ahead: the first version of this file, not pushed.
- `harta-locuri` is pushed and equal to `16d842f`.
- `emotii-extinse`, local only, not pushed: local `main` + the richer emotion model + this updated handoff.
- `harta-locuri-vechi` exists only locally. It holds an earlier, separate implementation, written before Anton's app landed on `main`. It is not needed and can be deleted.
- `C:\Users\Foica\source\repos\oradea-mood` is an old scratch copy. Ignore it.

## Known gaps and risks

- **Place profiles are editorial:**
  - each place's mood fit was set by hand and is not verified;
  - `verificatLa` is empty for every place;
  - two coordinates are approximate.
- **Tunnel address changes** on every `npm run public`. Quick tunnels have no uptime guarantee. The laptop must stay on and connected for the whole event.
- **Esri tiles** are free and need attribution, which is shown. A heavy or commercial deployment should check Esri's terms or get an API key. Real Google Maps tiles would need a Google API key.
- **The map shows only the public Oradea lobby's mood.** Group lobbies (`/l/g/<CODE>`, `LIGHTNING2`) do not drive recommendations yet.
- **`instantanee`** (history snapshots) has a table and API functions, but nothing writes to it.
- **No persistence for contributions:** a restart empties all lobbies.
- **Physical QA is still open:** a real phone keyboard, readability from audience distance, and three or more real phones through the tunnel (T1/T2/T7 in `qa/RESULTS.md`).
- **`qa/RESULTS.md`** describes Anton's version only. It does not cover the map or the tunnel.

## Suggested next steps

1. **Verify the catalog:** check each place in `data/locuri.json`, set `verificatLa` and add a source, and add more places if wanted.
2. **Rehearse end to end:** run `npm run public`, scan with 3+ phones on mobile data, and note the latency in `qa/RESULTS.md`.
3. **Recommendations per lobby:** let `/harta?lobby=<CODE>` use a group lobby's mood. Optionally show the top 1–2 places on the TV.
4. **Use or drop `AI_FALLBACK_MODEL`** in `lib/classification.mjs`.
5. **History:** record snapshots every 5 minutes into `instantanee` and show a small trend.
6. **Stable public URL:** for repeated events, use a named Cloudflare tunnel or host the server somewhere that keeps the process running.
